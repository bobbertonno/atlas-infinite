'use client'

import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { KeyRound, MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DemoConfig } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<{ stored: boolean; expired?: boolean }>)
const CONNECTION_STEP = 1

export function LiveCredentialsBanner({
  cfg,
  updateCfg,
}: {
  cfg: DemoConfig
  updateCfg: (patch: Partial<DemoConfig>) => void
}) {
  const router = useRouter()
  const { data } = useSWR(cfg.mode === 'live' ? '/api/atlas/credentials' : null, fetcher, { revalidateOnFocus: true })

  if (cfg.mode !== 'live' || !data || data.stored) return null

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 md:flex-row md:items-center">
      <KeyRound className="size-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">
          {data.expired ? 'Your Atlas session expired' : 'No Atlas credentials stored'}
        </p>
        <p className="text-sm text-muted-foreground text-pretty">
          {data.expired
            ? 'The server restarted and its ephemeral encryption key rotated, so the stored session can no longer be decrypted. Re-enter your service account credentials, or set ATLAS_LAB_SECRET to keep sessions across restarts.'
            : 'This demo is in Live Atlas Mode, so provisioning, loading, queries and workloads call the real Atlas API. Store a service account in the Connection step, or switch to Simulation Mode to run the full demo without credentials.'}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" onClick={() => updateCfg({ mode: 'simulation' })}>
          <MonitorPlay data-icon="inline-start" />
          Use Simulation
        </Button>
        <Button
          onClick={() => {
            updateCfg({ lastStep: CONNECTION_STEP })
            router.push(`/wizard/${cfg.id}`)
          }}
        >
          <KeyRound data-icon="inline-start" />
          Enter credentials
        </Button>
      </div>
    </div>
  )
}
