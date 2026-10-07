import type { Metadata } from 'next'
import StrategyDemoLauncher from './StrategyDemoLauncher'

const strategyDashboardUrl =
  'https://strategy-evidence-dashboard.vercel.app/?x-vercel-protection-bypass=e155b45630f7b6bbc9a33fc50f1fb59d&qa=debrand-production#view=strategy&profileId=bd-osj-principal&strategyTrack=lifecycle'

export const metadata: Metadata = {
  title: 'Strategy Dashboard | AmaduTown',
  description: 'Launch the Strategy Evidence Dashboard prototype.',
}

export default function StrategyDemoPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">
          AmaduTown Strategy Dashboard
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Opening the strategy prototype.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
          You are being forwarded to the current Strategy Evidence Dashboard. If the page does not
          open automatically, use the launch button below.
        </p>
        <div className="mt-8">
          <StrategyDemoLauncher dashboardUrl={strategyDashboardUrl} />
        </div>
      </section>
    </main>
  )
}
