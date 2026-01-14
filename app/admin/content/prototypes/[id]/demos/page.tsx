'use client'

import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

export default function PrototypeDemosPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Prototypes', href: '/admin/content/prototypes' },
            { label: 'Edit Prototype', href: `/admin/content/prototypes/${params.id}` },
            { label: 'Demos' }
          ]} />
          
          <h1 className="text-4xl font-bold mb-2">Manage Demos</h1>
          <p className="text-gray-400">Multiple demo management interface (Coming soon)</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}
