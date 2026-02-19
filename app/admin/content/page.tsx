'use client'

import { motion } from 'framer-motion'
import { FolderOpen, Video, BookOpen, Music, Sparkles, Package, Tag, Briefcase, Layers, ShoppingBag } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'

export default function ContentManagementPage() {
  const contentTypes = [
    {
      name: 'Projects',
      href: '/admin/content/projects',
      icon: <FolderOpen size={32} />,
      description: 'Manage portfolio projects',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Videos',
      href: '/admin/content/videos',
      icon: <Video size={32} />,
      description: 'Manage video content',
      color: 'from-red-500 to-pink-500',
    },
    {
      name: 'Publications',
      href: '/admin/content/publications',
      icon: <BookOpen size={32} />,
      description: 'Manage publications',
      color: 'from-green-500 to-emerald-500',
    },
    {
      name: 'Music',
      href: '/admin/content/music',
      icon: <Music size={32} />,
      description: 'Manage music projects',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Services',
      href: '/admin/content/services',
      icon: <Briefcase size={32} />,
      description: 'Manage services and offerings',
      color: 'from-teal-500 to-cyan-500',
    },
    {
      name: 'Products',
      href: '/admin/products',
      icon: <ShoppingBag size={32} />,
      description: 'Products, templates, and lead magnets',
      color: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'Prototypes',
      href: '/admin/content/prototypes',
      icon: <Sparkles size={32} />,
      description: 'Manage app prototype demos',
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Merchandise',
      href: '/admin/content/merchandise',
      icon: <Package size={32} />,
      description: 'Manage print-on-demand products',
      color: 'from-indigo-500 to-purple-500',
    },
    {
      name: 'Discount Codes',
      href: '/admin/content/discount-codes',
      icon: <Tag size={32} />,
      description: 'Manage discount codes and promotions',
      color: 'from-green-500 to-teal-500',
    },
    {
      name: 'Bundles',
      href: '/admin/sales/bundles',
      icon: <Layers size={32} />,
      description: 'Manage product bundles',
      color: 'from-amber-500 to-orange-500',
    },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management' }
          ]} />
          
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Content Management</h1>
            <p className="text-platinum-white/80">Manage your portfolio content</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contentTypes.map((type, index) => (
              <Link key={type.name} href={type.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="p-6 bg-silicon-slate border border-silicon-slate rounded-xl hover:border-radiant-gold/50 transition-all cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-bronze to-radiant-gold flex items-center justify-center text-imperial-navy mb-4">
                    {type.icon}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{type.name}</h3>
                  <p className="text-platinum-white/80 text-sm">{type.description}</p>
                </motion.div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  )
}
