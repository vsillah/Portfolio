import { NextResponse } from 'next/server'

const strategyDashboardUrl =
  'https://strategy-evidence-dashboard.vercel.app/?x-vercel-protection-bypass=e155b45630f7b6bbc9a33fc50f1fb59d&qa=debrand-production#view=strategy&profileId=bd-osj-principal&strategyTrack=lifecycle'

export function GET() {
  return NextResponse.redirect(strategyDashboardUrl, { status: 307 })
}

export function HEAD() {
  return new Response(null, {
    status: 307,
    headers: {
      Location: strategyDashboardUrl,
    },
  })
}
