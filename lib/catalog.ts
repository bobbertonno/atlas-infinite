import type { DatasetTemplate, StageId, WorkloadConfig, WorkloadTemplate } from './types'

export interface RegionInfo {
  id: string
  label: string
  azs: number
  infinite: boolean
}

/**
 * Offline catalog used for wizard validation in simulation mode. In Live Atlas
 * mode, region and tier support is re-validated against the Atlas Admin API.
 */
export const AWS_REGIONS: RegionInfo[] = [
  { id: 'US_EAST_1', label: 'N. Virginia (us-east-1)', azs: 3, infinite: true },
  { id: 'US_EAST_2', label: 'Ohio (us-east-2)', azs: 3, infinite: true },
  { id: 'US_WEST_2', label: 'Oregon (us-west-2)', azs: 3, infinite: true },
  { id: 'EU_WEST_1', label: 'Ireland (eu-west-1)', azs: 3, infinite: true },
  { id: 'EU_CENTRAL_1', label: 'Frankfurt (eu-central-1)', azs: 3, infinite: true },
  { id: 'EU_SOUTH_1', label: 'Milan (eu-south-1)', azs: 3, infinite: false },
  { id: 'AP_SOUTHEAST_1', label: 'Singapore (ap-southeast-1)', azs: 3, infinite: false },
  { id: 'AP_NORTHEAST_1', label: 'Tokyo (ap-northeast-1)', azs: 3, infinite: false },
  { id: 'SA_EAST_1', label: 'Sao Paulo (sa-east-1)', azs: 3, infinite: false },
]

export interface TierInfo {
  id: string
  vcpu: number
  ramGB: number
  core: boolean
  infinite: boolean
}

export const TIERS: TierInfo[] = [
  { id: 'M10', vcpu: 2, ramGB: 2, core: true, infinite: false },
  { id: 'M20', vcpu: 2, ramGB: 4, core: true, infinite: false },
  { id: 'M30', vcpu: 2, ramGB: 8, core: true, infinite: true },
  { id: 'M40', vcpu: 4, ramGB: 16, core: true, infinite: true },
  { id: 'M50', vcpu: 8, ramGB: 32, core: true, infinite: true },
  { id: 'M60', vcpu: 16, ramGB: 64, core: true, infinite: true },
  { id: 'M80', vcpu: 32, ramGB: 128, core: true, infinite: true },
  { id: 'M140', vcpu: 48, ramGB: 192, core: true, infinite: true },
  { id: 'M200', vcpu: 64, ramGB: 256, core: true, infinite: true },
]

export const tierIndex = (id: string) => TIERS.findIndex((t) => t.id === id)
export const tierInfo = (id: string) => TIERS.find((t) => t.id === id) ?? TIERS[2]
export const regionInfo = (id: string) => AWS_REGIONS.find((r) => r.id === id)

export const DATASET_TEMPLATES: Record<
  DatasetTemplate,
  { label: string; description: string; avgDocBytes: number; indexes: string[]; groupField: string }
> = {
  financial: {
    label: 'Financial Transactions',
    description: 'Card and ledger transactions with merchants, amounts and settlement status.',
    avgDocBytes: 640,
    indexes: ['accountId:1,ts:-1', 'status:1', 'merchant.category:1'],
    groupField: 'merchant.category',
  },
  customers: {
    label: 'Customer Profiles',
    description: 'Customer 360 profiles with contact details, loyalty tier and preferences.',
    avgDocBytes: 1100,
    indexes: ['email:1', 'tier:1,country:1'],
    groupField: 'tier',
  },
  audit: {
    label: 'Audit Events',
    description: 'Immutable security and compliance events with actors, actions and outcomes.',
    avgDocBytes: 480,
    indexes: ['actor:1,ts:-1', 'action:1', 'outcome:1'],
    groupField: 'action',
  },
  iot: {
    label: 'IoT Time Series',
    description: 'Device telemetry readings across sites and sensor metrics.',
    avgDocBytes: 320,
    indexes: ['deviceId:1,ts:-1', 'site:1,metric:1'],
    groupField: 'metric',
  },
  docmeta: {
    label: 'Document Metadata',
    description: 'Content management metadata: owners, tags, MIME types and versions.',
    avgDocBytes: 860,
    indexes: ['owner:1', 'tags:1', 'mime:1,version:-1'],
    groupField: 'mime',
  },
  custom: {
    label: 'Custom JSON Schema',
    description: 'Define fields and types; documents are generated deterministically from the schema.',
    avgDocBytes: 512,
    indexes: [],
    groupField: '',
  },
}

export const DEFAULT_CUSTOM_SCHEMA = JSON.stringify(
  {
    orderId: 'string',
    quantity: 'int',
    price: 'float',
    region: 'enum:NA|EMEA|APAC|LATAM',
    priority: 'bool',
    createdAt: 'date',
  },
  null,
  2,
)

export const WORKLOAD_TEMPLATES: Record<
  WorkloadTemplate,
  { label: string; description: string; preset: Partial<WorkloadConfig> }
> = {
  balanced: {
    label: 'Balanced OLTP',
    description: 'Mixed reads and writes on indexed queries at moderate concurrency.',
    preset: {
      readRatio: 70, concurrency: 16, targetOps: 1500, selectivity: 0.001, accessPattern: 'random',
      hotDataRatio: 80, aggregationComplexity: 'low', insertRate: 15, updateRate: 12, deleteRate: 3,
      readPreference: 'primary',
    },
  },
  'read-heavy': {
    label: 'Read-Heavy',
    description: 'Predominantly reads at high concurrency, optionally served by read-only nodes.',
    preset: {
      readRatio: 95, concurrency: 48, targetOps: 4000, selectivity: 0.001, accessPattern: 'random',
      hotDataRatio: 85, aggregationComplexity: 'none', insertRate: 3, updateRate: 2, deleteRate: 0,
      readPreference: 'secondaryPreferred',
    },
  },
  'out-of-cache': {
    label: 'Out-of-Cache',
    description: 'Uniform random reads across a large working set to explore storage access paths.',
    preset: {
      readRatio: 90, concurrency: 32, targetOps: 2500, selectivity: 0.0005, accessPattern: 'random',
      hotDataRatio: 10, aggregationComplexity: 'none', insertRate: 6, updateRate: 4, deleteRate: 0,
      readPreference: 'primary',
    },
  },
  'high-churn': {
    label: 'High-Churn',
    description: 'Frequent inserts, updates and deletes that stress the write path.',
    preset: {
      readRatio: 30, concurrency: 24, targetOps: 2000, selectivity: 0.001, accessPattern: 'random',
      hotDataRatio: 70, aggregationComplexity: 'none', insertRate: 35, updateRate: 25, deleteRate: 10,
      readPreference: 'primary',
    },
  },
  analytics: {
    label: 'Analytics',
    description: 'Aggregation pipelines and reporting queries over historical data.',
    preset: {
      readRatio: 98, concurrency: 8, targetOps: 120, selectivity: 0.2, accessPattern: 'sequential',
      hotDataRatio: 30, aggregationComplexity: 'high', insertRate: 2, updateRate: 0, deleteRate: 0,
      readPreference: 'secondaryPreferred',
    },
  },
  custom: { label: 'Custom', description: 'Fully user-defined workload parameters.', preset: {} },
}

type Notes = { executive: string; developer: string; architect: string }

export interface StageMeta {
  id: StageId
  title: string
  summary: string
  estimatedSec: number
  notes: Notes
}

export const STAGES: StageMeta[] = [
  {
    id: 'core-architecture',
    title: 'Atlas Core Architecture',
    summary: 'A three-node replica set where every member holds a full copy of the data.',
    estimatedSec: 120,
    notes: {
      executive: 'Atlas Core is the proven foundation trusted by tens of thousands of customers: three full copies of data across availability zones, automatic failover, zero operational effort.',
      developer: 'Your driver connects to a replica set. Writes go to the primary and replicate via the oplog to two secondaries. Read preference lets you route reads to secondaries.',
      architect: 'Each member owns local block storage, so durability comes from replication. Storage, IOPS and cache scale with the instance tier, and adding a member requires an initial sync of the full dataset.',
    },
  },
  {
    id: 'infinite-architecture',
    title: 'Atlas Infinite Architecture',
    summary: 'Two base compute nodes (Primary and Standby) on top of shared, disaggregated storage.',
    estimatedSec: 150,
    notes: {
      executive: 'Atlas Infinite separates compute from storage, so you pay for and scale each independently and grow storage without re-planning your cluster.',
      developer: 'Same drivers, same query API, same connection string format. The application code does not change; the storage layer underneath does.',
      architect: 'Compute nodes are stateless with respect to durable data. A log service provides consensus for writes, a page service materializes and serves pages, and an object store provides long-term durability. Read-only nodes attach to the same storage without copying data.',
    },
  },
  {
    id: 'provisioning',
    title: 'Cluster Provisioning',
    summary: 'Provision both deployments side by side and follow their lifecycle states.',
    estimatedSec: 90,
    notes: {
      executive: 'Both deployments are fully managed and provisioned through the same Atlas control plane and API.',
      developer: 'Provisioning is a declarative API call. We poll the cluster state until it reports IDLE.',
      architect: 'Core provisions three members with local volumes. Infinite provisions two compute nodes and attaches them to the shared storage service.',
    },
  },
  {
    id: 'data-loading',
    title: 'Data Generation and Loading',
    summary: 'Load the identical deterministic dataset into both clusters with checkpoints.',
    estimatedSec: 120,
    notes: {
      executive: 'We load exactly the same data into both clusters so every comparison is apples to apples.',
      developer: 'Documents are generated from a seed in bounded batches, inserted with unordered bulk writes, and checkpointed so loads can pause, resume and retry idempotently.',
      architect: 'Validation is separate from ingestion: we verify counts, indexes and a deterministic fingerprint of an ordered sample on each cluster.',
    },
  },
  {
    id: 'query-compat',
    title: 'Query Compatibility',
    summary: 'Run the same MongoDB queries and aggregations against both clusters.',
    estimatedSec: 90,
    notes: {
      executive: 'Your teams keep the same skills, tools and application code on either deployment.',
      developer: 'find, aggregate, updates and indexes behave identically. Results are compared field by field.',
      architect: 'The query layer and wire protocol are unchanged, so compatibility is a property of the platform rather than a migration project.',
    },
  },
  {
    id: 'read-write-paths',
    title: 'Read and Write Paths',
    summary: 'Follow a write and a read through each architecture.',
    estimatedSec: 120,
    notes: {
      executive: 'Both architectures make every acknowledged write durable; they simply achieve durability in different places.',
      developer: 'With w:majority, Core acknowledges after a majority of members persist the write. Infinite acknowledges once the log service commits it.',
      architect: 'Core reads are served from the member cache or local disk. Infinite reads hit the compute cache first and fall back to the page service for cache misses.',
    },
  },
  {
    id: 'workload',
    title: 'Workload Performance',
    summary: 'Drive an identical logical workload and compare latency percentiles and throughput.',
    estimatedSec: 180,
    notes: {
      executive: 'We look at responsiveness and throughput for a realistic workload profile, not a synthetic peak number.',
      developer: 'p50, p95 and p99 latencies are measured client-side per operation, alongside throughput and errors.',
      architect: 'Remember the context: compute generation, instance resources and cache warmth differ. These are not hardware-normalized results unless explicitly stated.',
    },
  },
  {
    id: 'read-scaling',
    title: 'Zero-Copy Read Scaling',
    summary: 'Add read-only capacity without copying data.',
    estimatedSec: 120,
    notes: {
      executive: 'Read capacity can be added for peak events quickly, because new nodes do not need to copy the dataset first.',
      developer: 'Route reads with readPreference or tag sets; the application sees more capacity behind the same connection string.',
      architect: 'In Core, a new member performs an initial sync proportional to data size. In Infinite, read-only nodes attach to shared storage and warm their cache on demand.',
    },
  },
  {
    id: 'independent-scaling',
    title: 'Independent Compute and Storage Scaling',
    summary: 'Scale compute and storage on separate axes.',
    estimatedSec: 120,
    notes: {
      executive: 'Right-size compute for traffic and let storage grow with data, instead of upsizing everything at once.',
      developer: 'No application changes are needed when compute tiers or storage capacity change.',
      architect: 'Core couples storage per member (three volumes). Infinite stores one logical copy in a durable shared tier, so storage growth is decoupled from compute tier choices.',
    },
  },
  {
    id: 'encryption',
    title: 'Encryption Architecture',
    summary: 'Encryption in transit, at rest and in use across both architectures.',
    estimatedSec: 90,
    notes: {
      executive: 'Both deployments are encrypted by default, with options to bring your own keys and encrypt sensitive fields end to end.',
      developer: 'TLS is always on. Client-Side Field Level Encryption and Queryable Encryption work through the same drivers.',
      architect: 'At-rest encryption applies to member volumes in Core and to the shared storage services in Infinite. Customer Key Management integrates with AWS KMS.',
    },
  },
  {
    id: 'backup-pitr',
    title: 'Backup and Point-in-Time Restore',
    summary: 'Choose a restore point and walk through the recovery flow.',
    estimatedSec: 120,
    notes: {
      executive: 'Recover to any point in time within the configured window with a guided, auditable restore.',
      developer: 'Restores are API-driven and can target the same or a different cluster.',
      architect: 'Core combines snapshots with oplog replay. Infinite builds on its storage layer and log to materialize a consistent point in time.',
    },
  },
  {
    id: 'results',
    title: 'Results and Recommendations',
    summary: 'Summarize findings and map workload profiles to the right architecture.',
    estimatedSec: 120,
    notes: {
      executive: 'Both are excellent choices. Pick based on data growth, elasticity needs and read scaling patterns.',
      developer: 'Your code is portable across both, so the decision can follow workload needs over time.',
      architect: 'Map each workload to its dominant constraint: steady-state OLTP, elastic reads, or large and fast-growing datasets.',
    },
  },
]

export const stageMeta = (id: StageId) => STAGES.find((s) => s.id === id)!
