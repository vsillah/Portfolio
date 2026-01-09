'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, LogOut, Settings, Download, Shield } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const { user, profile, isAdmin } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('[USER MENU DEBUG] User:', user.id)
      console.log('[USER MENU DEBUG] Profile:', profile)
      console.log('[USER MENU DEBUG] isAdmin:', isAdmin)
      console.log('[USER MENU DEBUG] Profile role:', profile?.role)
    }
  }, [user, profile, isAdmin])

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
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 hover:border-purple-500/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
          {user.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="hidden md:block text-gray-300 text-sm">{user.email}</span>
        {isAdmin && (
          <Shield className="text-purple-400" size={16} />
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden z-50"
          >
            <div className="p-2">
              <div className="px-3 py-2 border-b border-gray-800">
                <p className="text-sm font-semibold text-white">{user.email}</p>
                {isAdmin && (
                  <p className="text-xs text-purple-400 mt-1">Administrator</p>
                )}
              </div>

              <a
                href="/lead-magnets"
                className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Download size={16} />
                Lead Magnets
              </a>

              {isAdmin && (
                <>
                  <a
                    href="/admin"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Shield size={16} />
                    Analytics Dashboard
                  </a>
                  <a
                    href="/admin/content"
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings size={16} />
                    Content Management
                  </a>
                </>
              )}

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
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
