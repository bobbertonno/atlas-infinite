'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createDefaultConfig } from '@/lib/defaults'
import { configStore } from '@/lib/store'

export function NewDemoButton({ size = 'lg' }: { size?: 'lg' | 'default' }) {
  const router = useRouter()
  return (
    <Button
      size={size}
      onClick={() => {
        const cfg = configStore.upsert(createDefaultConfig())
        router.push(`/wizard/${cfg.id}`)
      }}
    >
      <Plus data-icon="inline-start" />
      New demo configuration
    </Button>
  )
}
