import { NextResponse } from 'next/server'
import type { Document, ReadPreferenceMode } from 'mongodb'
import { AtlasError } from '@/lib/server/atlas'
import { DB_NAME_RE, getMongoClient } from '@/lib/server/mongo'
import { getCredentials, sanitizeError } from '@/lib/server/session'
import { docId, generateDoc, groupFieldFor, mulberry32 } from '@/lib/dataset'
import type { DatasetConfig, WorkloadConfig } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const percentile = (sorted: number[], p: number) =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0

/** Runs one bounded burst (<= 8s) of the configured workload and reports client-measured latencies. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    clusterName: string
    dataset: DatasetConfig
    workload: WorkloadConfig
    burstMs?: number
    tick?: number
  } | null
  const creds = await getCredentials()
  if (!creds) return NextResponse.json({ error: 'No Atlas credentials stored.' }, { status: 401 })
  if (!body?.dataset || !DB_NAME_RE.test(body.dataset.database) || !DB_NAME_RE.test(body.dataset.collection)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { dataset: ds, workload: w } = body
  const burstMs = Math.min(8000, Math.max(1000, body.burstMs ?? 5000))
  const concurrency = Math.min(32, Math.max(1, Math.floor(w.concurrency)))
  const opBudgetPerSec = Math.max(1, w.targetOps)

  try {
    const client = await getMongoClient(creds, body.clusterName)
    const coll = client
      .db(ds.database)
      .collection<Document>(ds.collection, {
        readPreference: w.readPreference as ReadPreferenceMode,
        readConcern: { level: w.readConcern },
        writeConcern: { w: w.writeConcern === '1' ? 1 : 'majority' },
      })
    const field = groupFieldFor(ds)
    const rand = mulberry32((ds.seed * 31 + (body.tick ?? 0) * 997) >>> 0)
    const latencies: number[] = []
    const byType: Record<string, number> = { read: 0, aggregate: 0, insert: 0, update: 0, delete: 0 }
    let errors = 0
    let seq = 0
    let wlCounter = 0
    const deadline = Date.now() + burstMs
    const minGapMs = (1000 * concurrency) / opBudgetPerSec

    const pickIndex = () => {
      if (w.accessPattern === 'sequential') return seq++ % ds.documentCount
      const hotSize = Math.max(1, Math.floor(ds.documentCount * 0.1))
      return rand() * 100 < w.hotDataRatio ? Math.floor(rand() * hotSize) : Math.floor(rand() * ds.documentCount)
    }

    const runOp = async () => {
      const r = rand() * 100
      const writeTotal = w.insertRate + w.updateRate + w.deleteRate
      const isRead = r < w.readRatio
      if (isRead) {
        if (w.aggregationComplexity !== 'none' && rand() < 0.15) {
          byType.aggregate++
          const limit = { low: 1_000, medium: 10_000, high: 100_000 }[w.aggregationComplexity]
          await coll.aggregate([{ $limit: limit }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]).toArray()
        } else {
          byType.read++
          await coll.findOne({ _id: docId(ds, pickIndex()) as unknown as Document['_id'] }, { projection: { payload: 0 } })
        }
        return
      }
      const wr = rand() * Math.max(1, writeTotal)
      if (wr < w.insertRate) {
        byType.insert++
        const doc = generateDoc(ds, ds.documentCount + Math.floor(rand() * 1e6))
        await coll.insertOne({ ...doc, _id: `wl_${Date.now().toString(36)}_${wlCounter++}_${Math.floor(rand() * 1e9)}` as unknown as Document['_id'], workload: true })
      } else if (wr < w.insertRate + w.updateRate) {
        byType.update++
        await coll.updateOne({ _id: docId(ds, pickIndex()) as unknown as Document['_id'] }, { $set: { lastTouched: new Date() }, $inc: { touches: 1 } })
      } else {
        byType.delete++
        await coll.deleteOne({ workload: true })
      }
    }

    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (Date.now() < deadline) {
          const t0 = performance.now()
          try {
            await runOp()
            latencies.push(performance.now() - t0)
          } catch {
            errors++
          }
          const elapsed = performance.now() - t0
          if (elapsed < minGapMs) await new Promise((r) => setTimeout(r, minGapMs - elapsed))
        }
      }),
    )

    const sorted = latencies.sort((a, b) => a - b)
    const r2 = (n: number) => Math.round(n * 100) / 100
    return NextResponse.json({
      p50: r2(percentile(sorted, 50)),
      p95: r2(percentile(sorted, 95)),
      p99: r2(percentile(sorted, 99)),
      throughput: Math.round((latencies.length / burstMs) * 1000),
      ops: latencies.length,
      errors,
      byType,
    })
  } catch (err) {
    const status = err instanceof AtlasError ? err.status : 500
    return NextResponse.json({ error: sanitizeError(err) }, { status })
  }
}
