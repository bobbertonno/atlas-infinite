'use client'

import { createContext, useContext } from 'react'
import type { LatencyStats } from '@/lib/simulation'
import type { ClusterKind, DemoConfig } from '@/lib/types'

export interface LoadSummary {
  documents: number
  seconds: number
  validated: boolean
  fingerprint?: string
}

export interface DemoResults {
  workload?: Partial<Record<ClusterKind, LatencyStats>>
  load?: Partial<Record<ClusterKind, LoadSummary>>
  queriesMatched?: boolean
  provisioned?: Partial<Record<ClusterKind, boolean>>
}

export interface DemoContextValue {
  cfg: DemoConfig
  updateCfg: (patch: Partial<DemoConfig> | ((c: DemoConfig) => Partial<DemoConfig>)) => void
  speed: number
  live: boolean
  results: DemoResults
  setResults: (fn: (r: DemoResults) => DemoResults) => void
}

export const DemoContext = createContext<DemoContextValue | null>(null)

export function useDemo() {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside DemoRunner')
  return ctx
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

export const clusterOf = (cfg: DemoConfig, kind: ClusterKind) => (kind === 'core' ? cfg.core : cfg.infinite)
export const KIND_LABEL: Record<ClusterKind, string> = { core: 'Atlas Core Gen1', infinite: 'Atlas Infinite' }
