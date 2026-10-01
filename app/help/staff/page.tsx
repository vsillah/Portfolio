import type { Metadata } from 'next'
import Navigation from '@/components/Navigation'
import StaffGuide from '@/components/help/StaffGuide'
import { WEBSITE_COMPANY_NAME } from '@/lib/website-brand'

export const metadata: Metadata = {
  title: `Staff onboarding | ${WEBSITE_COMPANY_NAME}`,
  description: 'A practical introduction to Portfolio, the tools behind the work, and your first week.',
  robots: { index: false, follow: false },
}

export default function StaffGuidePage() {
  return <main className="staff-guide-page min-h-screen bg-background px-4 pb-16 pt-28 sm:px-8"><Navigation /><StaffGuide /></main>
}
