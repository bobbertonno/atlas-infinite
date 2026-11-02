'use client'

import { use } from 'react'
import { DemoRunner } from '@/components/demo/demo-runner'
import { ConfigGate } from '@/components/lab/config-gate'

export default function DemoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <ConfigGate id={id}>{(cfg) => <DemoRunner key={cfg.id} cfg={cfg} />}</ConfigGate>
}
