'use client'

import { useSyncExternalStore } from 'react'
import { newId, normalizeConfig } from './defaults'
import type { DemoConfig } from './types'

/**
 * Non-sensitive demo configurations are persisted in browser storage (no database
 * integration is connected). Atlas credentials never enter this store; they live
 * server-side in an encrypted, HTTP-only cookie.
 */
const KEY = 'atlas-lab:configs:v1'
const listeners = new Set<() => void>()
let cache: DemoConfig[] | null = null
const EMPTY: DemoConfig[] = []

function read(): DemoConfig[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Partial<DemoConfig>[]).map(normalizeConfig) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: DemoConfig[]) {
  cache = next
  localStorage.setItem(KEY, JSON.stringify(next))
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useConfigs() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function useConfig(id: string | null | undefined) {
  const all = useConfigs()
  return id ? all.find((c) => c.id === id) : undefined
}

export const configStore = {
  get: (id: string) => read().find((c) => c.id === id),
  upsert(cfg: DemoConfig) {
    const list = read()
    const next = { ...cfg, updatedAt: new Date().toISOString() }
    const i = list.findIndex((c) => c.id === cfg.id)
    write(i === -1 ? [next, ...list] : list.map((c, idx) => (idx === i ? next : c)))
    return next
  },
  remove(id: string) {
    write(read().filter((c) => c.id !== id))
  },
  duplicate(id: string, asTemplate = false) {
    const src = read().find((c) => c.id === id)
    if (!src) return undefined
    const now = new Date().toISOString()
    const copy: DemoConfig = {
      ...structuredClone(src),
      id: newId(),
      name: asTemplate ? `${src.name} (template)` : `${src.name} (copy)`,
      isTemplate: asTemplate,
      checkpoint: undefined,
      createdAt: now,
      updatedAt: now,
    }
    write([copy, ...read()])
    return copy
  },
  importProfile(json: unknown) {
    const obj = json as { kind?: string; config?: Partial<DemoConfig> }
    if (!obj || obj.kind !== 'atlas-infinite-lab-profile' || !obj.config) {
      throw new Error('Not a valid Atlas Infinite Lab profile.')
    }
    const now = new Date().toISOString()
    const cfg = normalizeConfig({ ...obj.config, id: newId(), createdAt: now, updatedAt: now, checkpoint: undefined })
    write([cfg, ...read()])
    return cfg
  },
}
