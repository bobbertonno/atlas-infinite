import { NextResponse } from 'next/server'
import type { Document } from 'mongodb'
import { AtlasError } from '@/lib/server/atlas'
import { DB_NAME_RE, getMongoClient } from '@/lib/server/mongo'
import { getCredentials, sanitizeError } from '@/lib/server/session'
import { FINGERPRINT_SAMPLE, fingerprintDocs, generateDoc, groupFieldFor, parseIndexSpec } from '@/lib/dataset'
import type { DatasetConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Body {
  action: 'reset' | 'load' | 'indexes' | 'verify' | 'queries'
  clusterName: string
  dataset: DatasetConfig
  start?: number
  count?: number
  writeConcern?: 'majority' | '1'
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null
  const creds = await getCredentials()
  if (!creds) return NextResponse.json({ error: 'No Atlas credentials stored.' }, { status: 401 })
  if (!body?.dataset || !DB_NAME_RE.test(body.dataset.database) || !DB_NAME_RE.test(body.dataset.collection)) {
    return NextResponse.json({ error: 'Invalid database or collection name.' }, { status: 400 })
  }
  const ds = body.dataset

  try {
    const client = await getMongoClient(creds, body.clusterName)
    const coll = client.db(ds.database).collection<Document>(ds.collection)

    switch (body.action) {
      case 'reset': {
        await coll.drop().catch(() => undefined)
        return NextResponse.json({ ok: true })
      }
      case 'load': {
        const start = Math.max(0, Math.floor(body.start ?? 0))
        const count = Math.min(5000, Math.max(1, Math.floor(body.count ?? 1000)))
        const end = Math.min(ds.documentCount, start + count)
        const docs: Document[] = []
        for (let i = start; i < end; i++) docs.push(generateDoc(ds, i))
        const t0 = performance.now()
        let inserted = 0
        let duplicates = 0
        try {
          const res = await coll.insertMany(docs, {
            ordered: false,
            writeConcern: { w: body.writeConcern === '1' ? 1 : 'majority' },
          })
          inserted = res.insertedCount
        } catch (err) {
          const e = err as { code?: number; result?: { insertedCount?: number }; writeErrors?: { code: number }[] | { code: number } }
          const writeErrors = Array.isArray(e.writeErrors) ? e.writeErrors : e.writeErrors ? [e.writeErrors] : []
          const nonDup = writeErrors.filter((w) => w.code !== 11000)
          if (e.code !== 11000 && (writeErrors.length === 0 || nonDup.length > 0)) throw err
          duplicates = writeErrors.length
          inserted = e.result?.insertedCount ?? docs.length - duplicates
        }
        return NextResponse.json({ ok: true, next: end, inserted, duplicates, durationMs: Math.round(performance.now() - t0) })
      }
      case 'indexes': {
        const specs = ds.indexes.map(parseIndexSpec).filter(Boolean) as Record<string, 1 | -1>[]
        if (specs.length) await coll.createIndexes(specs.map((key) => ({ key })))
        return NextResponse.json({ ok: true, created: specs.length })
      }
      case 'verify': {
        const [count, indexes, sample, stats] = await Promise.all([
          coll.countDocuments(),
          coll.indexes(),
          coll.find({}).sort({ _id: 1 }).limit(Math.min(ds.documentCount, FINGERPRINT_SAMPLE)).toArray(),
          coll
            .aggregate([{ $collStats: { storageStats: {} } }])
            .toArray()
            .then((r) => r[0]?.storageStats as { size?: number; storageSize?: number; totalIndexSize?: number; avgObjSize?: number } | undefined)
            .catch(() => undefined),
        ])
        return NextResponse.json({
          ok: true,
          count,
          indexes: indexes.map((i) => ({ name: i.name, key: i.key })),
          fingerprint: fingerprintDocs(sample),
          samples: sample.slice(0, 2),
          stats: stats
            ? { size: stats.size, storageSize: stats.storageSize, totalIndexSize: stats.totalIndexSize, avgObjSize: stats.avgObjSize }
            : null,
        })
      }
      case 'queries': {
        const field = groupFieldFor(ds)
        const time = async <T,>(fn: () => Promise<T>) => {
          const t0 = performance.now()
          const result = await fn()
          return { result, ms: Math.round((performance.now() - t0) * 100) / 100 }
        }
        const results = await Promise.all([
          time(() => coll.countDocuments()),
          time(() => coll.find({}, { projection: { payload: 0 } }).sort({ _id: 1 }).limit(3).toArray()),
          time(() => coll.findOne({ _id: generateDoc(ds, Math.floor(ds.documentCount / 2))._id as unknown as Document['_id'] }, { projection: { payload: 0 } })),
          time(() =>
            coll.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 5 }]).toArray(),
          ),
        ])
        return NextResponse.json({ ok: true, results })
      }
      default:
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
  } catch (err) {
    const status = err instanceof AtlasError ? err.status : 500
    return NextResponse.json({ error: sanitizeError(err) }, { status })
  }
}
