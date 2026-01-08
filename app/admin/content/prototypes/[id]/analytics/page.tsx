'use client'

import ProtectedRoute from '@/components/ProtectedRoute'

export default function PrototypeAnalyticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-gray-400">Per-prototype analytics dashboard (Coming soon)</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
