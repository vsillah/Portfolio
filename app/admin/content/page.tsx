'use client'

import { motion } from 'framer-motion'
import { FolderOpen, Video, BookOpen, Music, Sparkles, Package, Tag, Briefcase, Layers, ShoppingBag, Target } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Link from 'next/link'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import AgenticContentReviewPacketCard from '@/components/admin/AgenticContentReviewPacketCard'
import { getAgenticContentReviewPacketsForSurface } from '@/lib/agentic-content-review-packets'

export default function ContentManagementPage() {
  const proofReviewPackets = getAgenticContentReviewPacketsForSurface('content')
  const contentTypes = [
    {
      name: 'Outcome Groups',
      href: '/admin/content/outcome-groups',
      icon: <Target size={32} />,
      description: 'Group content by outcome (pricing chart)',
    },
    {
      name: 'Projects',
      href: '/admin/content/projects',
      icon: <FolderOpen size={32} />,
      description: 'Manage portfolio projects',
    },
    {
      name: 'Videos',
      href: '/admin/content/videos',
      icon: <Video size={32} />,
      description: 'Manage video content',
    },
    {
      name: 'Publications',
      href: '/admin/content/publications',
      icon: <BookOpen size={32} />,
      description: 'Manage publications',
    },
    {
      name: 'Agentified',
      href: '/admin/content/agentified',
      icon: <BookOpen size={32} />,
      description: 'Book workspace, manuscript gates, and Open Brain path',
    },
    {
      name: 'Music',
      href: '/admin/content/music',
      icon: <Music size={32} />,
      description: 'Manage music projects',
    },
    {
      name: 'Services',
      href: '/admin/content/services',
      icon: <Briefcase size={32} />,
      description: 'Manage services and offerings',
    },
    {
      name: 'Products',
      href: '/admin/products',
      icon: <ShoppingBag size={32} />,
      description: 'Products, templates, and lead magnets',
    },
    {
      name: 'Prototypes',
      href: '/admin/content/prototypes',
      icon: <Sparkles size={32} />,
      description: 'Manage app prototype demos',
    },
    {
      name: 'Merchandise',
      href: '/admin/content/merchandise',
      icon: <Package size={32} />,
      description: 'Manage print-on-demand products',
    },
    {
      name: 'Discount Codes',
      href: '/admin/content/discount-codes',
      icon: <Tag size={32} />,
      description: 'Manage discount codes and promotions',
    },
    {
      name: 'Bundles',
      href: '/admin/sales/bundles',
      icon: <Layers size={32} />,
      description: 'Manage product bundles',
    },
  ]

  return (
    <ProtectedRoute requireAdmin>
      <div className="admin-console-page min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Admin Dashboard', href: '/admin' },
            { label: 'Content Management' }
          ]} />
          
          <div className="admin-console-surface-header mb-6 rounded-xl border p-5 sm:p-6">
            <div className="admin-console-eyebrow mb-2">Content Hub</div>
            <h1 className="text-3xl font-bold text-foreground">Content Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Route publishing assets, product materials, prototypes, and offer content from one operating surface.
            </p>
          </div>

          <div className="admin-console-card mb-6 rounded-lg border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="admin-console-eyebrow mb-2">Agentic challenger loop</div>
                <h2 className="text-lg font-semibold text-foreground">P2 proof assets ready for human review</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  These proof and conversion assets have passed Amina challenger review. Editorial approval can happen here before PDF export, website implementation, client sharing, or public release.
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {proofReviewPackets.length} ready
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {proofReviewPackets.map((packet) => (
                <AgenticContentReviewPacketCard key={packet.assetId} packet={packet} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contentTypes.map((type, index) => (
              <Link key={type.name} href={type.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="admin-console-card admin-console-interactive flex h-full gap-4 rounded-lg border p-5 transition-all"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-radiant-gold/25 bg-radiant-gold/12 text-radiant-gold">
                    {type.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-foreground">{type.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </ProtectedRoute>
  )
}
