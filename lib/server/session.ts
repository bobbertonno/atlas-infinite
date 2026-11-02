import crypto from 'node:crypto'
import { cookies } from 'next/headers'

export interface AtlasCredentials {
  clientId: string
  clientSecret: string
  projectId: string
  orgId?: string
  dbUsername?: string
  dbPassword?: string
}

const COOKIE = 'atlas_lab_session'
const MAX_AGE = 60 * 60 * 8

const globalForSecret = globalThis as unknown as { __atlasLabEphemeralSecret?: string }

/**
 * AES-256-GCM key. Set ATLAS_LAB_SECRET for sessions that survive server restarts;
 * otherwise an ephemeral per-instance key is used and credentials must be re-entered
 * after a cold start (they are never persisted anywhere else).
 */
function key() {
  const secret =
    process.env.ATLAS_LAB_SECRET ??
    (globalForSecret.__atlasLabEphemeralSecret ??= crypto.randomBytes(32).toString('hex'))
  return crypto.createHash('sha256').update(secret).digest()
}

export const hasPersistentKey = () => Boolean(process.env.ATLAS_LAB_SECRET)

function seal(data: AtlasCredentials) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url')
}

function unseal(token: string): AtlasCredentials | null {
  try {
    const buf = Buffer.from(token, 'base64url')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()])
    return JSON.parse(dec.toString('utf8')) as AtlasCredentials
  } catch {
    return null
  }
}

export async function getCredentials() {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  return token ? unseal(token) : null
}

export async function setCredentials(data: AtlasCredentials) {
  const store = await cookies()
  store.set(COOKIE, seal(data), {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/api',
    maxAge: MAX_AGE,
  })
}

export async function clearCredentials() {
  const store = await cookies()
  store.set(COOKIE, '', { httpOnly: true, secure: true, sameSite: 'none', path: '/api', maxAge: 0 })
}

export function mask(value: string | undefined) {
  if (!value) return ''
  return value.length <= 6 ? '••••' : `${value.slice(0, 4)}••••${value.slice(-2)}`
}

/** Removes anything resembling credentials or connection strings from error text before returning it. */
export function sanitizeError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return msg
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, 'mongodb+srv://[redacted]')
    .replace(/(secret|password|token)[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, 400)
}
