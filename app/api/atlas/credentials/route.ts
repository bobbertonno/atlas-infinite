import { NextResponse } from 'next/server'
import { clearCredentials, getCredentials, hasPersistentKey, mask, setCredentials } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = await getCredentials()
  return NextResponse.json({
    stored: Boolean(c),
    clientId: mask(c?.clientId),
    projectId: c?.projectId ?? '',
    orgId: c?.orgId ?? '',
    dbUsername: c?.dbUsername ?? '',
    dbPasswordSet: Boolean(c?.dbPassword),
    persistentKey: hasPersistentKey(),
  })
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, string> | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const existing = await getCredentials()
  const clientId = body.clientId?.trim() || existing?.clientId
  const clientSecret = body.clientSecret?.trim() || existing?.clientSecret
  const projectId = body.projectId?.trim() || existing?.projectId
  if (!clientId || !clientSecret || !projectId) {
    return NextResponse.json({ error: 'Client ID, client secret and project ID are required.' }, { status: 400 })
  }
  if (!/^[a-f0-9]{24}$/i.test(projectId)) {
    return NextResponse.json({ error: 'Project ID must be a 24-character hexadecimal Atlas project ID.' }, { status: 400 })
  }
  const dbUsername = body.dbUsername?.trim() || existing?.dbUsername
  if (dbUsername && !/^[A-Za-z0-9._-]{1,64}$/.test(dbUsername)) {
    return NextResponse.json({ error: 'Database username may contain letters, digits, dot, dash and underscore.' }, { status: 400 })
  }
  await setCredentials({
    clientId,
    clientSecret,
    projectId,
    orgId: body.orgId?.trim() || existing?.orgId,
    dbUsername,
    dbPassword: body.dbPassword || existing?.dbPassword,
  })
  return NextResponse.json({ stored: true })
}

export async function DELETE() {
  await clearCredentials()
  return NextResponse.json({ stored: false })
}
