import type { Metadata } from 'next'
import ProtectedRoute from '@/components/ProtectedRoute'
import StaffOnboarding from '@/components/admin/onboarding/StaffOnboarding'

export const metadata: Metadata = { title: 'Staff onboarding | AmaduTown' }

export default function StaffOnboardingPage() {
  return <ProtectedRoute requireAdmin><StaffOnboarding /></ProtectedRoute>
}
