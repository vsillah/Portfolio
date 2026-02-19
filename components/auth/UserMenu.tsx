'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, LogOut, Download, Shield } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const { user, isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
    router.refresh()
  }

  if (!user) return null

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3 px-4 py-2 rounded-full glass-card border border-radiant-gold/30 hover:border-radiant-gold/60 transition-all duration-300"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-bronze via-radiant-gold to-gold-light flex items-center justify-center text-imperial-navy font-heading font-bold text-sm">
          {user.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        {/* Name/Email - hidden on mobile */}
        <span className="hidden md:block text-platinum-white/80 text-sm font-medium max-w-[120px] truncate">
          {user.email?.split('@')[0]}
        </span>
        {/* Admin badge */}
        {isAdmin && (
          <Shield className="text-radiant-gold" size={14} />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-64 glass-card border border-radiant-gold/20 rounded-xl overflow-hidden shadow-2xl z-50"
          >
            {/* User info header */}
            <div className="px-4 py-4 border-b border-radiant-gold/10 bg-imperial-navy/50">
              <p className="text-platinum-white font-medium text-sm truncate">{user.email}</p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 mt-1 text-xs text-radiant-gold">
                  <Shield size={12} />
                  Administrator
                </span>
              )}
            </div>

            {/* Menu items */}
            <div className="p-2">
              <a
                href="/resources"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-platinum-white/80 hover:text-radiant-gold hover:bg-radiant-gold/10 rounded-lg transition-all duration-200"
              >
                <Download size={16} />
                Resources
              </a>

              <a
                href="/purchases"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-platinum-white/80 hover:text-radiant-gold hover:bg-radiant-gold/10 rounded-lg transition-all duration-200"
              >
                <User size={16} />
                My Purchases
              </a>

              {isAdmin && (
                <a
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-platinum-white/80 hover:text-radiant-gold hover:bg-radiant-gold/10 rounded-lg transition-all duration-200"
                >
                  <Shield size={16} />
                  Admin Dashboard
                </a>
              )}

              <div className="my-2 border-t border-radiant-gold/10" />

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
