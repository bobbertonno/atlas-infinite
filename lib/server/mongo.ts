import { MongoClient } from 'mongodb'
import { AtlasError, getCluster } from './atlas'
import type { AtlasCredentials } from './session'

const globalForMongo = globalThis as unknown as { __atlasLabClients?: Map<string, Promise<MongoClient>> }
const clients: Map<string, Promise<MongoClient>> = (globalForMongo.__atlasLabClients ??= new Map<string, Promise<MongoClient>>())

export const NAME_RE = /^[A-Za-z0-9-]{1,64}$/
export const DB_NAME_RE = /^[A-Za-z0-9_-]{1,60}$/

export async function getMongoClient(creds: AtlasCredentials, clusterName: string): Promise<MongoClient> {
  if (!NAME_RE.test(clusterName)) throw new AtlasError(400, 'Invalid cluster name.')
  if (!creds.dbUsername || !creds.dbPassword) {
    throw new AtlasError(400, 'Database user credentials are not configured. Add them in Wizard step 2.')
  }
  const cacheKey = `${creds.projectId}:${clusterName}:${creds.dbUsername}`
  let p = clients.get(cacheKey)
  if (!p) {
    p = (async () => {
      const { data } = await getCluster(creds, clusterName)
      const srv = data.connectionStrings?.standardSrv
      if (!srv) throw new AtlasError(409, `Cluster "${clusterName}" is not ready for connections (state: ${data.stateName}).`)
      const uri = srv.replace(
        'mongodb+srv://',
        `mongodb+srv://${encodeURIComponent(creds.dbUsername!)}:${encodeURIComponent(creds.dbPassword!)}@`,
      )
      const client = new MongoClient(uri, {
        appName: 'atlas-infinite-experience-lab',
        maxPoolSize: 40,
        serverSelectionTimeoutMS: 10_000,
      })
      await client.connect()
      return client
    })()
    clients.set(cacheKey, p)
    p.catch(() => clients.delete(cacheKey))
  }
  return p
}
