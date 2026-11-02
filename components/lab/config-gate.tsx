'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { configStore } from '@/lib/store'
import { useHydrated } from '@/lib/use-hydrated'
import type { DemoConfig } from '@/lib/types'
import { SiteHeader } from './site-header'

/** Loads a config snapshot once on the client; children own their working copy. */
export function ConfigGate({ id, children }: { id: string; children: (cfg: DemoConfig) => ReactNode }) {
  const hydrated = useHydrated()
  const [snapshot] = useState(() => (typeof window === 'undefined' ? undefined : configStore.get(id)))
  const cfg = snapshot ?? (hydrated ? configStore.get(id) : undefined)

  if (!hydrated) return <div className="min-h-dvh" aria-busy="true" />
  if (!cfg) {
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
          <h1 className="text-xl font-semibold">Configuration not found</h1>
          <p className="text-sm text-muted-foreground">It may have been deleted, or it was created in a different browser.</p>
          <Button nativeButton={false} render={<Link href="/" />}>Back to library</Button>
        </main>
      </div>
    )
  }
  return <>{children(cfg)}</>
}
