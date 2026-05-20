'use client'

import SiteThemeCorner from '@/components/SiteThemeCorner'
import { Briefcase, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

type AuthShellProps = {
  children: ReactNode
}

const accessPoints = [
  {
    label: 'Admin operations',
    description: 'Dashboards, agent control, and delivery workflows',
    icon: Briefcase,
  },
  {
    label: 'Secure session',
    description: 'Account access stays behind the auth boundary',
    icon: ShieldCheck,
  },
  {
    label: 'Portfolio workspace',
    description: 'Lead evidence, reports, and client-facing tools',
    icon: Sparkles,
  },
]

export default function AuthShell({ children }: AuthShellProps) {
  return (
    <>
      <SiteThemeCorner />
      <main className="admin-console-page dark min-h-screen text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <section className="admin-console-surface-header hidden rounded-xl border p-8 lg:block">
              <div className="admin-console-eyebrow mb-4">
                <ShieldCheck className="h-4 w-4" />
                AmaduTown Portfolio
              </div>
              <h1 className="max-w-xl text-4xl font-bold leading-tight text-foreground">
                One secure entry point for the operating workspace.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
                Sign in once, then move through admin operations, client delivery,
                and agent control surfaces from the same workspace.
              </p>

              <div className="mt-8 grid gap-3">
                {accessPoints.map(({ label, description, icon: Icon }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-silicon-slate/35 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/25 bg-radiant-gold/10 text-radiant-gold">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mx-auto w-full max-w-md">{children}</div>
          </div>
        </div>
      </main>
    </>
  )
}
