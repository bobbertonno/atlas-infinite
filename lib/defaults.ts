import { DATASET_TEMPLATES, STAGES, WORKLOAD_TEMPLATES, DEFAULT_CUSTOM_SCHEMA } from './catalog'
import type { DemoConfig } from './types'

export function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `cfg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createDefaultConfig(): DemoConfig {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: 'Core vs Infinite — Financial OLTP',
    description: '',
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    isTemplate: false,
    lastStep: 0,
    mode: 'simulation',
    connection: {
      orgId: '',
      projectId: '',
      cloudProvider: 'AWS',
      region: 'US_EAST_1',
      dbUsername: 'atlas_lab_demo',
      networkMode: 'ip-access-list',
      ipAccessList: '',
    },
    core: {
      kind: 'core',
      name: 'demo-core-gen1',
      source: 'new',
      region: 'US_EAST_1',
      tier: 'M30',
      diskSizeGB: 40,
      backupEnabled: true,
      pitrEnabled: false,
      autoScaleCompute: false,
      autoScaleMinTier: 'M30',
      autoScaleMaxTier: 'M50',
      autoScaleDisk: true,
      readOnlyNodes: 0,
    },
    infinite: {
      kind: 'infinite',
      name: 'demo-infinite',
      source: 'new',
      region: 'US_EAST_1',
      tier: 'M30',
      diskSizeGB: 0,
      backupEnabled: true,
      pitrEnabled: true,
      autoScaleCompute: false,
      autoScaleMinTier: 'M30',
      autoScaleMaxTier: 'M50',
      autoScaleDisk: true,
      readOnlyNodes: 0,
    },
    dataset: {
      template: 'financial',
      name: 'Financial Transactions',
      database: 'atlas_lab',
      collection: 'transactions',
      collections: 1,
      documentCount: 200_000,
      avgDocBytes: DATASET_TEMPLATES.financial.avgDocBytes,
      seed: 42,
      batchSize: 1000,
      workers: 4,
      indexes: [...DATASET_TEMPLATES.financial.indexes],
      distribution: 'skewed',
      updatesPerMin: 600,
      deletesPerMin: 30,
      historicalRatio: 70,
      customSchema: DEFAULT_CUSTOM_SCHEMA,
    },
    loading: {
      target: 'both',
      reuseExisting: false,
      resetBeforeLoad: true,
      batchSize: 1000,
      parallelism: 4,
      maxRetries: 3,
      writeConcern: 'majority',
      indexStrategy: 'after',
      validation: 'sample',
    },
    workload: {
      template: 'balanced',
      readRatio: 70,
      concurrency: 16,
      targetOps: 1500,
      durationSec: 60,
      selectivity: 0.001,
      accessPattern: 'random',
      hotDataRatio: 80,
      aggregationComplexity: 'low',
      insertRate: 15,
      updateRate: 12,
      deleteRate: 3,
      readPreference: 'primary',
      readConcern: 'local',
      writeConcern: 'majority',
      ...WORKLOAD_TEMPLATES.balanced.preset,
    },
    guided: {
      stages: STAGES.map((s) => ({ id: s.id, enabled: true })),
      progression: 'manual',
      autoAdvanceSec: 45,
      animationSpeed: 1,
      speakerNotes: true,
      detailLevel: 'standard',
      audience: 'architect',
    },
  }
}

/** Deep-merges a partial/older config onto defaults so imported or legacy profiles stay valid. */
export function normalizeConfig(input: Partial<DemoConfig>): DemoConfig {
  const d = createDefaultConfig()
  const cfg: DemoConfig = {
    ...d,
    ...input,
    connection: { ...d.connection, ...input.connection },
    core: { ...d.core, ...input.core, kind: 'core' },
    infinite: { ...d.infinite, ...input.infinite, kind: 'infinite' },
    dataset: { ...d.dataset, ...input.dataset },
    loading: { ...d.loading, ...input.loading },
    workload: { ...d.workload, ...input.workload },
    guided: { ...d.guided, ...input.guided },
  }
  const known = new Set(STAGES.map((s) => s.id))
  const stages = (cfg.guided.stages ?? []).filter((s) => known.has(s.id))
  for (const s of STAGES) if (!stages.find((x) => x.id === s.id)) stages.push({ id: s.id, enabled: false })
  cfg.guided.stages = stages
  return cfg
}

/** Strips anything environment-specific before export. Credentials are never stored client-side to begin with. */
export function toExportProfile(cfg: DemoConfig) {
  const { id: _id, checkpoint: _cp, createdAt: _c, updatedAt: _u, ...rest } = cfg
  return {
    kind: 'atlas-infinite-lab-profile',
    version: 1,
    exportedAt: new Date().toISOString(),
    config: {
      ...rest,
      connection: { ...rest.connection, orgId: '', projectId: '', ipAccessList: '' },
    },
  }
}
