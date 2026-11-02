import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { atlas, AtlasError, publicCluster, type AtlasCluster } from '@/lib/server/atlas'
import { getCredentials, sanitizeError, setCredentials } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

type Action =
  | 'test-connection'
  | 'validate-credentials'
  | 'validate-permissions'
  | 'list-clusters'
  | 'validate-region'
  | 'rate-limits'
  | 'quotas'
  | 'apply-access-list'
  | 'create-db-user'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: Action
    region?: string
    tier?: string
    cidr?: string
  }
  const creds = await getCredentials()
  if (!creds) return NextResponse.json({ ok: false, message: 'No Atlas credentials stored for this session.' }, { status: 401 })
  const g = `/groups/${creds.projectId}`

  try {
    switch (body.action) {
      case 'test-connection': {
        const { data } = await atlas<{ name: string; clusterCount: number }>(creds, g)
        return NextResponse.json({ ok: true, message: `Connected to project "${data.name}" (${data.clusterCount} clusters).` })
      }
      case 'validate-credentials': {
        await atlas(creds, g)
        return NextResponse.json({ ok: true, message: 'Service account token issued and accepted by the Atlas Admin API.' })
      }
      case 'validate-permissions': {
        await atlas(creds, `${g}/accessList?itemsPerPage=1`)
        await atlas(creds, `${g}/databaseUsers?itemsPerPage=1`)
        return NextResponse.json({
          ok: true,
          message: 'Read access to project network and database users confirmed. Cluster write permission (Project Owner or Project Cluster Manager) is verified at provisioning time.',
        })
      }
      case 'list-clusters': {
        const { data } = await atlas<{ results: AtlasCluster[] }>(creds, `${g}/clusters`, { version: '2024-08-05' })
        return NextResponse.json({ ok: true, message: `${data.results.length} cluster(s) found.`, clusters: data.results.map(publicCluster) })
      }
      case 'validate-region': {
        const tier = body.tier ?? 'M30'
        const region = body.region ?? 'US_EAST_1'
        const { data } = await atlas<{
          results: { provider: string; instanceSizes: { name: string; availableRegions: { name: string }[] }[] }[]
        }>(creds, `${g}/clusters/provider/regions?providers=AWS&tier=${encodeURIComponent(tier)}`)
        const regions = new Set(
          data.results.flatMap((p) => p.instanceSizes.filter((s) => s.name === tier).flatMap((s) => s.availableRegions.map((r) => r.name))),
        )
        const supported = regions.has(region)
        return NextResponse.json({
          ok: supported,
          message: supported
            ? `${tier} is available in AWS ${region} for this project.`
            : `${tier} is not offered in AWS ${region}. Available: ${[...regions].slice(0, 8).join(', ') || 'none'}.`,
          alternatives: [...regions].slice(0, 12),
        })
      }
      case 'rate-limits': {
        const { rateLimit } = await atlas(creds, g)
        return NextResponse.json({
          ok: true,
          message:
            rateLimit.limit || rateLimit.remaining
              ? `Rate limit ${rateLimit.limit ?? 'n/a'}, remaining ${rateLimit.remaining ?? 'n/a'} in the current window.`
              : 'No rate-limit headers returned. The lab paces API polling to well below documented Atlas Admin API limits (status polling every 10s).',
        })
      }
      case 'quotas': {
        const { data } = await atlas<{ name: string; value: number; currentUsage?: number }[]>(creds, `${g}/limits`)
        const relevant = (Array.isArray(data) ? data : []).filter((l) => /cluster|user|access/i.test(l.name)).slice(0, 8)
        return NextResponse.json({
          ok: true,
          message: relevant.length ? `${relevant.length} relevant project limits retrieved.` : 'Project limits retrieved; defaults apply.',
          limits: relevant,
        })
      }
      case 'apply-access-list': {
        const cidr = body.cidr?.trim() ?? ''
        if (!/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(cidr)) {
          return NextResponse.json({ ok: false, message: 'Enter a valid IPv4 CIDR block, for example 203.0.113.10/32.' }, { status: 400 })
        }
        await atlas(creds, `${g}/accessList`, {
          method: 'POST',
          body: [{ cidrBlock: cidr, comment: 'Atlas Infinite Experience Lab' }],
        })
        return NextResponse.json({ ok: true, message: `Access list entry ${cidr} added to the project.` })
      }
      case 'create-db-user': {
        const username = creds.dbUsername
        if (!username) return NextResponse.json({ ok: false, message: 'Set a database username first.' }, { status: 400 })
        const password = creds.dbPassword ?? crypto.randomBytes(18).toString('base64url')
        await atlas(creds, `${g}/databaseUsers`, {
          method: 'POST',
          body: {
            databaseName: 'admin',
            username,
            password,
            groupId: creds.projectId,
            roles: [{ databaseName: 'admin', roleName: 'readWriteAnyDatabase' }],
            description: 'Atlas Infinite Experience Lab demo user',
          },
        })
        if (!creds.dbPassword) await setCredentials({ ...creds, dbPassword: password })
        return NextResponse.json({
          ok: true,
          message: `Database user "${username}" created with readWriteAnyDatabase. The password is stored server-side only.`,
        })
      }
      default:
        return NextResponse.json({ ok: false, message: 'Unknown action.' }, { status: 400 })
    }
  } catch (err) {
    const status = err instanceof AtlasError ? err.status : 500
    return NextResponse.json({ ok: false, message: sanitizeError(err) }, { status: status >= 400 && status < 600 ? status : 500 })
  }
}
