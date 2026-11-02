import { tierInfo } from './catalog'
import { mulberry32 } from './dataset'
import type { ClusterConfig, ClusterKind, DemoConfig, WorkloadConfig } from './types'

export interface LatencyStats {
  p50: number
  p95: number
  p99: number
  throughput: number
  errors: number
  ops: number
  byType: Record<string, number>
}

export interface WorkloadTick extends LatencyStats {
  t: number
}

/**
 * Illustrative latency model for Simulation Mode. It is deliberately conservative
 * and balanced: it encodes architectural tendencies (cache-miss paths, write
 * acknowledgement paths, read fan-out), not measured or hardware-normalized results.
 */
function baseProfile(kind: ClusterKind, w: WorkloadConfig) {
  const writeShare = (w.insertRate + w.updateRate + w.deleteRate) / 100
  const coldShare = (100 - w.hotDataRatio) / 100
  const aggCost = { none: 0, low: 4, medium: 18, high: 60 }[w.aggregationComplexity]
  const readBase = kind === 'core' ? 1.4 + coldShare * 3.6 : 1.5 + coldShare * 3.1
  const writeBase = kind === 'core' ? 2.6 : 2.9
  const p50 = readBase * (1 - writeShare) + writeBase * writeShare + aggCost * (w.aggregationComplexity === 'none' ? 0 : 0.35)
  return { p50, tail: 2.4 + coldShare * 1.4 }
}

export function readCapacityMultiplier(cluster: ClusterConfig, w: WorkloadConfig) {
  const toSecondaries = w.readPreference !== 'primary'
  if (cluster.kind === 'core') return toSecondaries ? 1.8 : 1
  return (toSecondaries ? 1.35 : 1) + cluster.readOnlyNodes * 0.85
}

export function simulateTick(cfg: DemoConfig, kind: ClusterKind, t: number, seedOffset = 0): WorkloadTick {
  const cluster = kind === 'core' ? cfg.core : cfg.infinite
  const w = cfg.workload
  const rand = mulberry32(cfg.dataset.seed * 7919 + t * 31 + (kind === 'core' ? 1 : 2) + seedOffset)
  const { p50: baseP50, tail } = baseProfile(kind, w)
  const tier = tierInfo(cluster.tier)
  const tierFactor = Math.sqrt(8 / tier.vcpu)
  const capacity = tier.vcpu * 900 * readCapacityMultiplier(cluster, w) * (w.aggregationComplexity === 'high' ? 0.05 : 1)
  const demand = w.targetOps
  const utilization = Math.min(1.6, demand / capacity)
  const queueing = utilization > 0.8 ? 1 + (utilization - 0.8) * 4 : 1
  const warmup = kind === 'infinite' && t < 8 ? 1 + (8 - t) * 0.06 : t < 5 ? 1 + (5 - t) * 0.04 : 1
  const noise = 0.92 + rand() * 0.16
  const p50 = baseP50 * tierFactor * queueing * warmup * noise
  const p95 = p50 * (tail * 0.75 + rand() * 0.2)
  const p99 = p50 * (tail * 1.35 + rand() * 0.5)
  const throughput = Math.min(demand, capacity / Math.max(1, queueing * 0.7)) * (0.96 + rand() * 0.06)
  const ops = Math.round(throughput)
  const readShare = w.readRatio / 100
  const writeTotal = Math.max(1, w.insertRate + w.updateRate + w.deleteRate)
  const writeOps = ops * (1 - readShare)
  return {
    t,
    p50: round(p50),
    p95: round(p95),
    p99: round(p99),
    throughput: Math.round(throughput),
    errors: utilization > 1.3 && rand() < 0.3 ? 1 : 0,
    ops,
    byType: {
      read: Math.round(ops * readShare * (w.aggregationComplexity === 'none' ? 1 : 0.85)),
      aggregate: Math.round(ops * readShare * (w.aggregationComplexity === 'none' ? 0 : 0.15)),
      insert: Math.round((writeOps * w.insertRate) / writeTotal),
      update: Math.round((writeOps * w.updateRate) / writeTotal),
      delete: Math.round((writeOps * w.deleteRate) / writeTotal),
    },
  }
}

export function summarize(ticks: LatencyStats[]): LatencyStats {
  if (ticks.length === 0) return { p50: 0, p95: 0, p99: 0, throughput: 0, errors: 0, ops: 0, byType: {} }
  const avg = (k: 'p50' | 'p95' | 'p99' | 'throughput') => ticks.reduce((a, b) => a + b[k], 0) / ticks.length
  const byType: Record<string, number> = {}
  for (const t of ticks) for (const [k, v] of Object.entries(t.byType)) byType[k] = (byType[k] ?? 0) + v
  return {
    p50: round(avg('p50')),
    p95: round(avg('p95')),
    p99: round(avg('p99')),
    throughput: Math.round(avg('throughput')),
    errors: ticks.reduce((a, b) => a + b.errors, 0),
    ops: ticks.reduce((a, b) => a + b.ops, 0),
    byType,
  }
}

/** Seconds a new Core replica-set member needs for initial sync (illustrative). */
export function initialSyncSeconds(dataBytes: number) {
  const throughputBytesPerSec = 120 * 1024 * 1024
  return 180 + dataBytes / throughputBytesPerSec
}

export const READ_ONLY_ATTACH_SECONDS = 240

function round(n: number) {
  return Math.round(n * 100) / 100
}

export const PROVISION_STEPS: Record<ClusterKind, { label: string; detail: string; weight: number }[]> = {
  core: [
    { label: 'Validating configuration', detail: 'Tier, region and backup policy accepted by the control plane', weight: 1 },
    { label: 'Allocating 3 compute instances', detail: 'One electable member per availability zone', weight: 3 },
    { label: 'Attaching local volumes', detail: 'Three independent storage volumes, one per member', weight: 2 },
    { label: 'Initiating replica set', detail: 'Electing primary, configuring oplog replication', weight: 2 },
    { label: 'Configuring TLS, auth and backup', detail: 'Encryption at rest, SCRAM users, snapshot schedule', weight: 1 },
    { label: 'IDLE', detail: 'Cluster ready to accept connections', weight: 0 },
  ],
  infinite: [
    { label: 'Validating configuration', detail: 'Tier, region and PITR policy accepted by the control plane', weight: 1 },
    { label: 'Provisioning shared storage', detail: 'Log service, page service and object index provisioned', weight: 2 },
    { label: 'Allocating Primary and Standby compute', detail: 'Two stateless compute nodes across availability zones', weight: 2 },
    { label: 'Attaching compute to storage', detail: 'Nodes register with the log and page services', weight: 1 },
    { label: 'Configuring TLS, auth and PITR', detail: 'Encryption at rest, SCRAM users, continuous backup', weight: 1 },
    { label: 'IDLE', detail: 'Cluster ready to accept connections', weight: 0 },
  ],
}
