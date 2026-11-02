export type DemoMode = 'simulation' | 'live'
export type ClusterKind = 'core' | 'infinite'

export type DatasetTemplate =
  | 'financial'
  | 'customers'
  | 'audit'
  | 'iot'
  | 'docmeta'
  | 'custom'

export type WorkloadTemplate =
  | 'balanced'
  | 'read-heavy'
  | 'out-of-cache'
  | 'high-churn'
  | 'analytics'
  | 'custom'

export type StageId =
  | 'core-architecture'
  | 'infinite-architecture'
  | 'provisioning'
  | 'data-loading'
  | 'query-compat'
  | 'read-write-paths'
  | 'workload'
  | 'read-scaling'
  | 'independent-scaling'
  | 'encryption'
  | 'backup-pitr'
  | 'results'

export type NetworkMode = 'ip-access-list' | 'private-endpoint' | 'vpc-peering'

export interface AtlasConnectionConfig {
  orgId: string
  projectId: string
  cloudProvider: 'AWS'
  region: string
  dbUsername: string
  networkMode: NetworkMode
  ipAccessList: string
}

export interface ClusterConfig {
  kind: ClusterKind
  name: string
  source: 'new' | 'existing'
  region: string
  tier: string
  diskSizeGB: number
  backupEnabled: boolean
  pitrEnabled: boolean
  autoScaleCompute: boolean
  autoScaleMinTier: string
  autoScaleMaxTier: string
  autoScaleDisk: boolean
  readOnlyNodes: number
}

export interface DatasetConfig {
  template: DatasetTemplate
  name: string
  database: string
  collection: string
  collections: number
  documentCount: number
  avgDocBytes: number
  seed: number
  batchSize: number
  workers: number
  indexes: string[]
  distribution: 'uniform' | 'skewed' | 'normal'
  updatesPerMin: number
  deletesPerMin: number
  historicalRatio: number
  customSchema: string
}

export interface LoadingConfig {
  target: 'both' | 'core' | 'infinite'
  reuseExisting: boolean
  resetBeforeLoad: boolean
  batchSize: number
  parallelism: number
  maxRetries: number
  writeConcern: 'majority' | '1'
  indexStrategy: 'before' | 'after'
  validation: 'full' | 'sample' | 'none'
}

export interface WorkloadConfig {
  template: WorkloadTemplate
  readRatio: number
  concurrency: number
  targetOps: number
  durationSec: number
  selectivity: number
  accessPattern: 'random' | 'sequential'
  hotDataRatio: number
  aggregationComplexity: 'none' | 'low' | 'medium' | 'high'
  insertRate: number
  updateRate: number
  deleteRate: number
  readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest'
  readConcern: 'local' | 'majority' | 'available'
  writeConcern: 'majority' | '1'
}

export interface StageSetting {
  id: StageId
  enabled: boolean
}

export interface GuidedConfig {
  stages: StageSetting[]
  progression: 'manual' | 'auto'
  autoAdvanceSec: number
  animationSpeed: number
  speakerNotes: boolean
  detailLevel: 'overview' | 'standard' | 'deep'
  audience: 'executive' | 'developer' | 'architect'
}

export interface LoadCheckpoint {
  core: number
  infinite: number
  updatedAt: string
}

export interface DemoConfig {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'ready'
  isTemplate: boolean
  lastStep: number
  mode: DemoMode
  connection: AtlasConnectionConfig
  core: ClusterConfig
  infinite: ClusterConfig
  dataset: DatasetConfig
  loading: LoadingConfig
  workload: WorkloadConfig
  guided: GuidedConfig
  checkpoint?: LoadCheckpoint
}
