import type { AtlasCredentials } from './session'

const BASE = 'https://cloud.mongodb.com'
const tokenCache = new Map<string, { token: string; expiresAt: number }>()

/** Atlas Service Account (OAuth 2.0 client credentials) token exchange. */
async function getAccessToken(c: AtlasCredentials) {
  const cached = tokenCache.get(c.clientId)
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token
  const res = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new AtlasError(res.status, res.status === 401 ? 'Service account credentials were rejected.' : `Token exchange failed (${res.status}).`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache.set(c.clientId, { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 })
  return json.access_token
}

export class AtlasError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorCode?: string,
  ) {
    super(message)
  }
}

export interface AtlasResponse<T> {
  data: T
  status: number
  rateLimit: { limit?: string; remaining?: string }
}

export async function atlas<T = unknown>(
  c: AtlasCredentials,
  path: string,
  init: { method?: string; body?: unknown; version?: string } = {},
): Promise<AtlasResponse<T>> {
  const token = await getAccessToken(c)
  const res = await fetch(`${BASE}/api/atlas/v2${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: `application/vnd.atlas.${init.version ?? '2023-01-01'}+json`,
      ...(init.body ? { 'Content-Type': `application/vnd.atlas.${init.version ?? '2023-01-01'}+json` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })
  const rateLimit = {
    limit: res.headers.get('x-ratelimit-limit') ?? undefined,
    remaining: res.headers.get('x-ratelimit-remaining') ?? undefined,
  }
  const text = await res.text()
  const json = text ? safeJson(text) : null
  if (!res.ok) {
    const j = json as { detail?: string; errorCode?: string } | null
    throw new AtlasError(res.status, j?.detail ?? `Atlas API returned ${res.status}`, j?.errorCode)
  }
  return { data: json as T, status: res.status, rateLimit }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export interface AtlasCluster {
  name: string
  stateName: string
  clusterType?: string
  mongoDBVersion?: string
  paused?: boolean
  backupEnabled?: boolean
  pitEnabled?: boolean
  connectionStrings?: { standardSrv?: string }
  replicationSpecs?: {
    regionConfigs?: {
      regionName?: string
      providerName?: string
      electableSpecs?: { instanceSize?: string; nodeCount?: number; diskSizeGB?: number }
      readOnlySpecs?: { instanceSize?: string; nodeCount?: number }
    }[]
  }[]
}

/** Shapes a cluster for the browser. Connection strings never leave the server. */
export function publicCluster(c: AtlasCluster) {
  const rc = c.replicationSpecs?.[0]?.regionConfigs?.[0]
  return {
    name: c.name,
    stateName: c.stateName,
    clusterType: c.clusterType,
    mongoDBVersion: c.mongoDBVersion,
    paused: c.paused,
    backupEnabled: c.backupEnabled,
    pitEnabled: c.pitEnabled,
    region: rc?.regionName,
    provider: rc?.providerName,
    instanceSize: rc?.electableSpecs?.instanceSize,
    nodeCount: rc?.electableSpecs?.nodeCount,
    diskSizeGB: rc?.electableSpecs?.diskSizeGB,
    readOnlyNodes: rc?.readOnlySpecs?.nodeCount ?? 0,
    connectable: Boolean(c.connectionStrings?.standardSrv),
  }
}

export const getCluster = (c: AtlasCredentials, name: string) =>
  atlas<AtlasCluster>(c, `/groups/${c.projectId}/clusters/${encodeURIComponent(name)}`, { version: '2024-08-05' })
