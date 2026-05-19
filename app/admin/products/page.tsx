'use client'

import { motion } from 'framer-motion'
import { ShoppingBag, Download, ArrowRight } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

export default function ProductsHubPage() {
  const sections = [
    {
      name: 'Products',
      href: '/admin/content/products',
      icon: <ShoppingBag size={32} />,
      description: 'Ebooks, templates, calculators, apps, and digital products',
    },
    {
      name: 'Lead Magnets',
      href: '/admin/content/lead-magnets',
      icon: <Download size={32} />,
      description: 'Manage downloadable resources and lead capture',
    },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Products' },
          ]} />

          <div className="admin-console-surface-header mb-6 rounded-xl border p-5 sm:p-6">
            <div className="admin-console-eyebrow mb-2">Content Hub</div>
            <h1 className="text-3xl font-bold text-foreground">Products</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Manage the product catalog and lead capture assets that feed the public store and sales workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections.map((section, index) => (
              <Link key={section.name} href={section.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="admin-console-card admin-console-interactive flex h-full items-center gap-4 rounded-lg border p-5 transition-all"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/25 bg-radiant-gold/12 text-radiant-gold">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground">{section.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-radiant-gold" />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
