'use client'

import { use } from 'react'
import { Wizard } from '@/components/wizard/wizard'
import { ConfigGate } from '@/components/lab/config-gate'

export default function WizardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ConfigGate id={id}>{(cfg) => <Wizard key={cfg.id} initial={cfg} />}</ConfigGate>
}
