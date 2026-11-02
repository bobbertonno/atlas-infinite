import { NextResponse } from 'next/server'
import { atlas, AtlasError, getCluster, publicCluster, type AtlasCluster } from '@/lib/server/atlas'
import { NAME_RE } from '@/lib/server/mongo'
import { getCredentials, sanitizeError } from '@/lib/server/session'
import { TIERS } from '@/lib/catalog'
import type { ClusterConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get('name') ?? ''
  const creds = await getCredentials()
  if (!creds) return NextResponse.json({ error: 'No Atlas credentials stored.' }, { status: 401 })
  if (!NAME_RE.test(name)) return NextResponse.json({ error: 'Invalid cluster name.' }, { status: 400 })
  try {
    const { data } = await getCluster(creds, name)
    return NextResponse.json({ cluster: publicCluster(data) })
  } catch (err) {
    const status = err instanceof AtlasError ? err.status : 500
    return NextResponse.json({ error: sanitizeError(err) }, { status })
  }
}

/**
 * Provisions an Atlas Core Gen1 replica set. Atlas Infinite deployments are attached
 * as existing clusters: create them in the Atlas UI or with the API version that
 * supports Infinite in your organization, then reference them by name.
 */
export async function POST(req: Request) {
  const creds = await getCredentials()
  if (!creds) return NextResponse.json({ error: 'No Atlas credentials stored.' }, { status: 401 })
  const cluster = (await req.json().catch(() => null)) as ClusterConfig | null
  if (!cluster || cluster.kind !== 'core') {
    return NextResponse.json({ error: 'Only Atlas Core clusters are provisioned by the lab. Attach Atlas Infinite as an existing cluster.' }, { status: 400 })
  }
  if (!NAME_RE.test(cluster.name)) return NextResponse.json({ error: 'Invalid cluster name.' }, { status: 400 })
  if (!TIERS.some((t) => t.id === cluster.tier && t.core)) return NextResponse.json({ error: 'Unsupported tier.' }, { status: 400 })
  if (!/^[A-Z0-9_]{3,30}$/.test(cluster.region)) return NextResponse.json({ error: 'Invalid region.' }, { status: 400 })
  const diskSizeGB = Math.min(4096, Math.max(10, Math.round(cluster.diskSizeGB)))

  try {
    const existing = await getCluster(creds, cluster.name).catch((e) => (e instanceof AtlasError && e.status === 404 ? null : Promise.reject(e)))
    if (existing) return NextResponse.json({ cluster: publicCluster(existing.data), reused: true })

    const { data } = await atlas<AtlasCluster>(creds, `/groups/${creds.projectId}/clusters`, {
      method: 'POST',
      version: '2024-08-05',
      body: {
        name: cluster.name,
        clusterType: 'REPLICASET',
        backupEnabled: cluster.backupEnabled,
        pitEnabled: cluster.backupEnabled && cluster.pitrEnabled,
        replicationSpecs: [
          {
            regionConfigs: [
              {
                providerName: 'AWS',
                regionName: cluster.region,
                priority: 7,
                electableSpecs: { instanceSize: cluster.tier, nodeCount: 3, diskSizeGB },
                autoScaling: {
                  diskGB: { enabled: cluster.autoScaleDisk },
                  compute: cluster.autoScaleCompute
                    ? { enabled: true, scaleDownEnabled: true, minInstanceSize: cluster.autoScaleMinTier, maxInstanceSize: cluster.autoScaleMaxTier }
                    : { enabled: false, scaleDownEnabled: false },
                },
              },
            ],
          },
        ],
      },
    })
    return NextResponse.json({ cluster: publicCluster(data), reused: false })
  } catch (err) {
    const status = err instanceof AtlasError ? err.status : 500
    return NextResponse.json({ error: sanitizeError(err) }, { status })
  }
}
