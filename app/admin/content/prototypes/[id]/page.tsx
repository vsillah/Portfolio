'use client'

import ProtectedRoute from '@/components/ProtectedRoute'

export default function PrototypeEditPage() {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Edit Prototype</h1>
          <p className="text-gray-400">Prototype editing interface (Coming soon)</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
