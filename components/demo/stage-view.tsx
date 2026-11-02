'use client'

import type { StageId } from '@/lib/types'
import { CoreArchitectureStage, EncryptionStage, InfiniteArchitectureStage, ReadWritePathsStage } from './stages/architecture-stages'
import { ProvisioningStage } from './stages/provisioning-stage'
import { DataLoadingStage } from './stages/data-loading-stage'
import { QueryCompatStage } from './stages/query-stage'
import { WorkloadStage } from './stages/workload-stage'
import { IndependentScalingStage, ReadScalingStage } from './stages/scaling-stages'
import { BackupStage } from './stages/backup-stage'
import { ResultsStage } from './stages/results-stage'

const VIEWS: Record<StageId, () => React.JSX.Element> = {
  'core-architecture': CoreArchitectureStage,
  'infinite-architecture': InfiniteArchitectureStage,
  provisioning: ProvisioningStage,
  'data-loading': DataLoadingStage,
  'query-compat': QueryCompatStage,
  'read-write-paths': ReadWritePathsStage,
  workload: WorkloadStage,
  'read-scaling': ReadScalingStage,
  'independent-scaling': IndependentScalingStage,
  encryption: EncryptionStage,
  'backup-pitr': BackupStage,
  results: ResultsStage,
}

export function StageView({ id }: { id: StageId }) {
  const View = VIEWS[id]
  return <View />
}
