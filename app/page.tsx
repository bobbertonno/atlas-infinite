import { SiteHeader } from '@/components/lab/site-header'
import { ConfigLibrary } from '@/components/home/config-library'
import { HomeHero } from '@/components/home/home-hero'

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 md:px-6 md:py-12">
        <HomeHero />
        <ConfigLibrary />
      </main>
    </div>
  )
}
