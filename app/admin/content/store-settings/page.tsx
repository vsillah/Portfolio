'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Settings, Share2, Save, Loader } from 'lucide-react'
import ProtectedRoute from '@/components/ProtectedRoute'
import Breadcrumbs from '@/components/admin/Breadcrumbs'
import { getCurrentSession } from '@/lib/auth'

interface SocialShareDiscount {
  type: 'fixed' | 'percentage'
  value: number
}

export default function StoreSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [socialShareDiscount, setSocialShareDiscount] = useState<SocialShareDiscount>({
    type: 'fixed',
    value: 5,
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/store-settings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (response.ok) {
        const data = await response.json()
        const s = data.settings?.social_share_discount
        if (s && typeof s.type === 'string' && typeof s.value === 'number') {
          setSocialShareDiscount({
            type: s.type === 'percentage' ? 'percentage' : 'fixed',
            value: s.value >= 0 ? s.value : 5,
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch store settings:', err)
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const session = await getCurrentSession()
      if (!session) return

      const response = await fetch('/api/admin/store-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          social_share_discount: {
            type: socialShareDiscount.type,
            value: Number(socialShareDiscount.value),
          },
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved.' })
      } else {
        const data = await response.json().catch(() => ({}))
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' })
      }
    } catch (err) {
      console.error('Failed to save store settings:', err)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
          <div className="max-w-2xl mx-auto flex items-center justify-center">
            <Loader className="animate-spin text-platinum-white/80" size={32} />
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requireAdmin>
      <div className="min-h-screen bg-background text-foreground pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Breadcrumbs
            items={[
              { label: 'Store', href: '/store' },
              { label: 'Content Hub', href: '/admin/content' },
              { label: 'Store Settings', href: '/admin/content/store-settings' },
            ]}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings className="text-radiant-gold" size={28} />
              <h1 className="text-3xl font-bold">Store Settings</h1>
            </div>
            <p className="text-platinum-white/80">
              Configure store-wide behaviour such as the social share reward shown to customers after purchase.
            </p>
          </motion.div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-silicon-slate border border-silicon-slate rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Share2 className="text-purple-400" size={22} />
                <h2 className="text-xl font-bold">Social share reward</h2>
              </div>
              <p className="text-platinum-white/80 text-sm mb-4">
                The discount amount or percentage shown in the post-purchase share message (e.g. &quot;Get yours today with this link and save $5&quot;). Customers see this when they share their purchase on social media.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-platinum-white/90 mb-2">Type</label>
                  <select
                    value={socialShareDiscount.type}
                    onChange={(e) =>
                      setSocialShareDiscount((s) => ({
                        ...s,
                        type: e.target.value as 'fixed' | 'percentage',
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground"
                  >
                    <option value="fixed">Fixed amount ($)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-platinum-white/90 mb-2">
                    {socialShareDiscount.type === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={socialShareDiscount.type === 'percentage' ? 1 : 0.01}
                    value={socialShareDiscount.value}
                    onChange={(e) =>
                      setSocialShareDiscount((s) => ({
                        ...s,
                        value: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="w-full px-4 py-2 rounded-lg bg-background border border-silicon-slate text-foreground"
                  />
                </div>
              </div>
              <p className="text-platinum-white/60 text-xs mt-2">
                Preview: &quot;...save {socialShareDiscount.type === 'fixed' ? `$${socialShareDiscount.value}` : `${socialShareDiscount.value}%`}.&quot;
              </p>
            </div>

            {message && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                    : 'bg-red-600/20 text-red-400 border border-red-600/50'
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r btn-gold text-imperial-navy font-semibold disabled:opacity-50"
            >
              {saving ? (
                <Loader className="animate-spin" size={18} />
              ) : (
                <Save size={18} />
              )}
              Save settings
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  )
}
