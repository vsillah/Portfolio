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
      color: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'Lead Magnets',
      href: '/admin/content/lead-magnets',
      icon: <Download size={32} />,
      description: 'Manage downloadable resources and lead capture',
      color: 'from-orange-500 to-amber-500',
    },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management', href: '/admin/content' },
            { label: 'Products' },
          ]} />

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Products</h1>
            <p className="text-gray-400">Manage products, templates, and lead magnets</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sections.map((section, index) => (
              <Link key={section.name} href={section.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-emerald-500/30 transition-all cursor-pointer flex items-center gap-4"
                >
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-r ${section.color} flex items-center justify-center text-white shrink-0`}>
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-1">{section.name}</h3>
                    <p className="text-gray-400 text-sm">{section.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-500 shrink-0" />
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
