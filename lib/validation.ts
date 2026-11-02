import { AWS_REGIONS, regionInfo, tierIndex, tierInfo } from './catalog'
import { parseIndexSpec, validateCustomSchema } from './dataset'
import type { ClusterConfig, DemoConfig } from './types'

export interface Issue {
  level: 'error' | 'warning'
  message: string
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/
const DB_RE = /^[A-Za-z0-9_-]{1,60}$/

export const WIZARD_STEPS = [
  { id: 'mode', title: 'Demo mode', short: 'Mode' },
  { id: 'connection', title: 'Atlas connection', short: 'Connection' },
  { id: 'clusters', title: 'Cluster configuration', short: 'Clusters' },
  { id: 'dataset', title: 'Dataset factory', short: 'Dataset' },
  { id: 'loading', title: 'Data loading', short: 'Loading' },
  { id: 'workload', title: 'Workload', short: 'Workload' },
  { id: 'guided', title: 'Guided demo', short: 'Guided demo' },
  { id: 'review', title: 'Review & launch', short: 'Review' },
] as const

export type StepId = (typeof WIZARD_STEPS)[number]['id']

function clusterIssues(c: ClusterConfig, mode: DemoConfig['mode']): Issue[] {
  const out: Issue[] = []
  const label = c.kind === 'core' ? 'Atlas Core' : 'Atlas Infinite'
  if (!NAME_RE.test(c.name)) out.push({ level: 'error', message: `${label}: cluster name must be 1-64 letters, digits or hyphens.` })
  const tier = tierInfo(c.tier)
  if (c.kind === 'core' && !tier.core) out.push({ level: 'error', message: `${label}: ${c.tier} is not available for Core.` })
  if (c.kind === 'infinite' && !tier.infinite) out.push({ level: 'error', message: `${label}: ${c.tier} is not offered for Infinite. Use M30 or above.` })
  const region = regionInfo(c.region)
  if (!region) out.push({ level: 'error', message: `${label}: unknown region ${c.region}.` })
  else if (c.kind === 'infinite' && !region.infinite) {
    const alts = AWS_REGIONS.filter((r) => r.infinite).map((r) => r.id).join(', ')
    out.push({ level: 'error', message: `${label}: not yet available in ${region.label}. Try ${alts}.` })
  }
  if (c.kind === 'core' && (c.diskSizeGB < 10 || c.diskSizeGB > 4096)) out.push({ level: 'error', message: `${label}: storage must be between 10 and 4096 GB.` })
  if (c.kind === 'core' && c.readOnlyNodes > 0) out.push({ level: 'error', message: `${label}: read-only nodes are configured on the Infinite deployment in this lab.` })
  if (c.readOnlyNodes < 0 || c.readOnlyNodes > 5) out.push({ level: 'error', message: `${label}: read-only nodes must be between 0 and 5.` })
  if (c.pitrEnabled && !c.backupEnabled) out.push({ level: 'error', message: `${label}: point-in-time restore requires backup.` })
  if (c.autoScaleCompute) {
    const lo = tierIndex(c.autoScaleMinTier)
    const hi = tierIndex(c.autoScaleMaxTier)
    const cur = tierIndex(c.tier)
    if (lo > cur || hi < cur) out.push({ level: 'error', message: `${label}: auto-scaling range must include the selected tier ${c.tier}.` })
  }
  if (mode === 'live' && c.kind === 'infinite' && c.source === 'new') {
    out.push({
      level: 'error',
      message: 'Atlas Infinite: in Live mode, create the Infinite deployment in Atlas first and attach it as an existing cluster.',
    })
  }
  return out
}

export function validateStep(cfg: DemoConfig, step: StepId): Issue[] {
  const out: Issue[] = []
  switch (step) {
    case 'connection':
      if (cfg.mode === 'live') {
        if (!/^[a-f0-9]{24}$/i.test(cfg.connection.projectId)) out.push({ level: 'error', message: 'A 24-character Atlas project ID is required in Live mode.' })
        if (!/^[A-Za-z0-9._-]{1,64}$/.test(cfg.connection.dbUsername)) out.push({ level: 'error', message: 'Database username is required.' })
        if (cfg.connection.networkMode === 'ip-access-list' && !cfg.connection.ipAccessList)
          out.push({ level: 'warning', message: 'No IP access list entry configured. Atlas will reject connections from unlisted addresses.' })
        if (cfg.connection.networkMode !== 'ip-access-list')
          out.push({ level: 'warning', message: 'Private networking requires the app to run in a network that can reach the private endpoint (for example Vercel Secure Compute).' })
      }
      break
    case 'clusters':
      out.push(...clusterIssues(cfg.core, cfg.mode), ...clusterIssues(cfg.infinite, cfg.mode))
      if (cfg.core.name === cfg.infinite.name) out.push({ level: 'error', message: 'Cluster names must be different.' })
      if (cfg.core.region !== cfg.infinite.region)
        out.push({ level: 'warning', message: 'Clusters are in different regions; network latency will differ between them.' })
      break
    case 'dataset': {
      const d = cfg.dataset
      if (!DB_RE.test(d.database)) out.push({ level: 'error', message: 'Database name may contain letters, digits, dash and underscore.' })
      if (!DB_RE.test(d.collection)) out.push({ level: 'error', message: 'Collection name may contain letters, digits, dash and underscore.' })
      if (d.documentCount < 1) out.push({ level: 'error', message: 'Document count must be at least 1.' })
      if (cfg.mode === 'live' && d.documentCount > 5_000_000)
        out.push({ level: 'error', message: 'Live mode loads through serverless functions; keep it at 5,000,000 documents or fewer.' })
      if (d.template === 'custom') {
        const err = validateCustomSchema(d.customSchema)
        if (err) out.push({ level: 'error', message: err })
      }
      for (const idx of d.indexes) if (!parseIndexSpec(idx)) out.push({ level: 'error', message: `Invalid index spec "${idx}".` })
      if (d.collections > 1 && cfg.mode === 'live')
        out.push({ level: 'warning', message: 'Live mode loads the primary collection; additional collections are modeled in estimates only.' })
      break
    }
    case 'loading':
      if (cfg.loading.batchSize < 100 || cfg.loading.batchSize > 5000) out.push({ level: 'error', message: 'Batch size must be between 100 and 5000.' })
      if (cfg.loading.writeConcern === '1') out.push({ level: 'warning', message: 'w:1 speeds up loading but acknowledges before majority durability.' })
      break
    case 'workload': {
      const w = cfg.workload
      const writes = w.insertRate + w.updateRate + w.deleteRate
      if (Math.abs(writes + w.readRatio - 100) > 0.5)
        out.push({ level: 'error', message: `Read ratio plus write mix must total 100% (currently ${w.readRatio + writes}%).` })
      if (w.readPreference !== 'primary' && w.readConcern === 'majority')
        out.push({ level: 'warning', message: 'Secondary reads with readConcern majority may see slightly older data than the primary.' })
      if (w.readPreference.startsWith('secondary') && cfg.infinite.readOnlyNodes === 0)
        out.push({ level: 'warning', message: 'Infinite has no read-only nodes; secondary reads will be served by the Standby node.' })
      break
    }
    case 'guided':
      if (!cfg.guided.stages.some((s) => s.enabled)) out.push({ level: 'error', message: 'Enable at least one stage.' })
      break
  }
  return out
}

export function validateAll(cfg: DemoConfig) {
  return WIZARD_STEPS.map((s) => ({ step: s.id, issues: validateStep(cfg, s.id) }))
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error')
