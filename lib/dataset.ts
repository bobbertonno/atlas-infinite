import { DATASET_TEMPLATES } from './catalog'
import type { DatasetConfig } from './types'

export type Doc = Record<string, unknown> & { _id: string }

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mix(seed: number, index: number) {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ index, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

const BASE_EPOCH = Date.UTC(2026, 0, 1)
const DAY = 86_400_000

const MERCHANTS = ['Northwind', 'Contoso', 'Fabrikam', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Stark', 'Wayne', 'Acme']
const CATEGORIES = ['grocery', 'travel', 'electronics', 'dining', 'utilities', 'health', 'fuel', 'retail']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'BRL']
const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken', 'Radia', 'Edsger']
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Hamilton', 'Ritchie', 'Liskov', 'Thompson', 'Perlman', 'Dijkstra']
const COUNTRIES = ['US', 'DE', 'GB', 'IT', 'FR', 'JP', 'BR', 'IN']
const ACTIONS = ['login', 'logout', 'read', 'update', 'delete', 'export', 'grant', 'revoke']
const METRICS = ['temperature', 'humidity', 'pressure', 'vibration', 'voltage']
const UNITS: Record<string, string> = { temperature: 'C', humidity: '%', pressure: 'hPa', vibration: 'mm/s', voltage: 'V' }
const MIMES = ['application/pdf', 'image/png', 'text/markdown', 'application/json', 'video/mp4']
const TAGS = ['legal', 'finance', 'hr', 'engineering', 'marketing', 'confidential', 'archive', 'draft']

const pick = <T,>(arr: T[], r: number) => arr[Math.floor(r * arr.length) % arr.length]
const round2 = (n: number) => Math.round(n * 100) / 100
const PAD_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function skewed(r: number, distribution: DatasetConfig['distribution']) {
  if (distribution === 'skewed') return r * r * r
  if (distribution === 'normal') {
    const d = r - 0.5
    return Math.min(0.9999, 0.5 + Math.sign(d) * (d * d * 2))
  }
  return r
}

function timestamp(rand: () => number, historicalRatio: number) {
  const historical = rand() * 100 < historicalRatio
  const ageDays = historical ? 30 + rand() * 1065 : rand() * 30
  return new Date(BASE_EPOCH - Math.floor(ageDays * DAY))
}

export function docId(cfg: Pick<DatasetConfig, 'template' | 'seed'>, index: number) {
  return `${cfg.template.slice(0, 3)}_${cfg.seed}_${index.toString().padStart(10, '0')}`
}

function parseSchema(schema: string): Record<string, string> {
  try {
    const parsed = JSON.parse(schema)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'string')) as Record<string, string>
    }
  } catch {}
  return {}
}

export function validateCustomSchema(schema: string): string | null {
  const parsed = parseSchema(schema)
  if (Object.keys(parsed).length === 0) return 'Schema must be a JSON object of field: type pairs.'
  for (const [field, type] of Object.entries(parsed)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(field)) return `Invalid field name "${field}".`
    if (!/^(string|int|float|bool|date|enum:.+)$/.test(type)) return `Unsupported type "${type}" for "${field}".`
  }
  return null
}

/** Generates document `index` for the dataset. Pure and random-access: the same seed and index always produce the same document. */
export function generateDoc(cfg: DatasetConfig, index: number): Doc {
  const rand = mulberry32(mix(cfg.seed, index))
  const s = (r: number) => skewed(r, cfg.distribution)
  const _id = docId(cfg, index)
  let doc: Doc

  switch (cfg.template) {
    case 'financial':
      doc = {
        _id,
        accountId: `acct_${Math.floor(s(rand()) * 50_000).toString().padStart(6, '0')}`,
        amount: round2(5 + rand() * 2_000),
        currency: pick(CURRENCIES, rand()),
        merchant: { name: pick(MERCHANTS, rand()), category: pick(CATEGORIES, rand()) },
        status: rand() < 0.92 ? 'settled' : rand() < 0.5 ? 'pending' : 'reversed',
        channel: rand() < 0.6 ? 'card' : 'transfer',
        ts: timestamp(rand, cfg.historicalRatio),
      }
      break
    case 'customers': {
      const first = pick(FIRST, rand())
      const last = pick(LAST, rand())
      doc = {
        _id,
        name: { first, last },
        email: `${first}.${last}.${index}@example.com`.toLowerCase(),
        tier: pick(['bronze', 'silver', 'gold', 'platinum'], s(rand())),
        country: pick(COUNTRIES, rand()),
        lifetimeValue: round2(rand() * 25_000),
        preferences: { newsletter: rand() < 0.4, language: pick(['en', 'de', 'it', 'fr', 'ja'], rand()) },
        since: timestamp(rand, cfg.historicalRatio),
      }
      break
    }
    case 'audit':
      doc = {
        _id,
        actor: `user_${Math.floor(s(rand()) * 5_000)}`,
        action: pick(ACTIONS, rand()),
        resource: `res/${pick(['db', 'bucket', 'api', 'vault'], rand())}/${Math.floor(rand() * 1_000)}`,
        ip: `10.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`,
        outcome: rand() < 0.97 ? 'success' : 'denied',
        ts: timestamp(rand, cfg.historicalRatio),
      }
      break
    case 'iot': {
      const metric = pick(METRICS, rand())
      doc = {
        _id,
        deviceId: `dev_${Math.floor(s(rand()) * 10_000).toString().padStart(5, '0')}`,
        site: `site_${Math.floor(rand() * 40)}`,
        metric,
        value: round2(rand() * 100),
        unit: UNITS[metric],
        ts: timestamp(rand, cfg.historicalRatio),
      }
      break
    }
    case 'docmeta':
      doc = {
        _id,
        title: `Document ${index}`,
        owner: `${pick(FIRST, s(rand())).toLowerCase()}@example.com`,
        tags: [pick(TAGS, rand()), pick(TAGS, rand())],
        mime: pick(MIMES, rand()),
        sizeBytes: Math.floor(rand() * 50_000_000),
        version: 1 + Math.floor(rand() * 12),
        modified: timestamp(rand, cfg.historicalRatio),
      }
      break
    default: {
      doc = { _id }
      for (const [field, type] of Object.entries(parseSchema(cfg.customSchema))) {
        if (type === 'string') doc[field] = `${field}_${Math.floor(rand() * 1e6)}`
        else if (type === 'int') doc[field] = Math.floor(s(rand()) * 1_000)
        else if (type === 'float') doc[field] = round2(rand() * 1_000)
        else if (type === 'bool') doc[field] = rand() < 0.5
        else if (type === 'date') doc[field] = timestamp(rand, cfg.historicalRatio)
        else if (type.startsWith('enum:')) doc[field] = pick(type.slice(5).split('|'), s(rand()))
      }
    }
  }

  const base = JSON.stringify(doc).length
  const padLen = Math.max(0, cfg.avgDocBytes - base - 14)
  if (padLen > 0) {
    let pad = ''
    for (let i = 0; i < padLen; i++) pad += PAD_CHARS[Math.floor(rand() * PAD_CHARS.length)]
    doc.payload = pad
  }
  return doc
}

export function* generateBatches(cfg: DatasetConfig, start: number, end: number, batchSize: number) {
  for (let i = start; i < end; i += batchSize) {
    const batch: Doc[] = []
    for (let j = i; j < Math.min(end, i + batchSize); j++) batch.push(generateDoc(cfg, j))
    yield batch
  }
}

export function fnv1a(str: string, hash = 0x811c9dc5) {
  let h = hash >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export const FINGERPRINT_SAMPLE = 500

/** Deterministic fingerprint over the first N documents ordered by _id. */
export function expectedFingerprint(cfg: DatasetConfig) {
  const n = Math.min(cfg.documentCount, FINGERPRINT_SAMPLE)
  let h = 0x811c9dc5
  for (let i = 0; i < n; i++) h = fnv1a(JSON.stringify(generateDoc(cfg, i)), h)
  return h.toString(16).padStart(8, '0')
}

export function fingerprintDocs(docs: unknown[]) {
  let h = 0x811c9dc5
  for (const d of docs) h = fnv1a(JSON.stringify(d), h)
  return h.toString(16).padStart(8, '0')
}

export function parseIndexSpec(spec: string): Record<string, 1 | -1> | null {
  const out: Record<string, 1 | -1> = {}
  for (const part of spec.split(',')) {
    const [field, dir] = part.trim().split(':')
    if (!field || !/^[A-Za-z_][A-Za-z0-9_.]{0,80}$/.test(field)) return null
    out[field] = dir?.trim() === '-1' ? -1 : 1
  }
  return Object.keys(out).length ? out : null
}

export function groupFieldFor(cfg: DatasetConfig) {
  if (cfg.template !== 'custom') return DATASET_TEMPLATES[cfg.template].groupField
  const entries = Object.entries(parseSchema(cfg.customSchema))
  return (entries.find(([, t]) => t.startsWith('enum:') || t === 'bool') ?? entries[0])?.[0] ?? '_id'
}

export function estimateDataset(cfg: DatasetConfig) {
  const logicalBytes = cfg.documentCount * cfg.avgDocBytes * Math.max(1, cfg.collections)
  const indexBytes = logicalBytes * (0.08 + cfg.indexes.length * 0.06)
  const docsPerSecPerWorker = Math.max(1500, 40_000 / Math.max(1, cfg.avgDocBytes / 256))
  const loadSeconds = (cfg.documentCount * Math.max(1, cfg.collections)) / (docsPerSecPerWorker * Math.max(1, cfg.workers))
  return {
    documents: cfg.documentCount * Math.max(1, cfg.collections),
    logicalBytes,
    indexBytes,
    loadSeconds,
    generatorMemoryBytes: cfg.batchSize * cfg.avgDocBytes * 2 * Math.max(1, cfg.workers),
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let u = 0
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024
    u++
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[u]}`
}

export function formatDuration(sec: number) {
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`
}
