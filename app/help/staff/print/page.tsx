import type { Metadata } from 'next'
import StaffGuide from '@/components/help/StaffGuide'
import { WEBSITE_COMPANY_NAME } from '@/lib/website-brand'

export const metadata: Metadata = {
  title: `Staff onboarding — print | ${WEBSITE_COMPANY_NAME}`,
  robots: { index: false, follow: false },
}

export default function StaffGuidePrintPage() {
  return <main className="staff-guide-page min-h-screen bg-background px-4 py-10 sm:px-8"><StaffGuide printMode /></main>
}
