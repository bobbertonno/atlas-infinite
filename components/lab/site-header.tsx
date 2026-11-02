import Link from 'next/link'
import type { ReactNode } from 'react'
import { MongoLeaf } from './mode-badge'

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <MongoLeaf className="text-primary" />
          <span className="text-balance">Atlas Infinite Experience Lab</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  )
}
