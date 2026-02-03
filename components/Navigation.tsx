'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, User, LogOut, Shield, Download } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import { useAuth } from '@/components/AuthProvider'
import { signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const navItems = [
  { name: 'Home', href: '#home' },
  { name: 'Projects', href: '#projects' },
  { name: 'Prototypes', href: '#prototypes' },
  { name: 'Publications', href: '#publications' },
  { name: 'Music', href: '#music' },
  { name: 'Videos', href: '#videos' },
  { name: 'Store', href: '#store' },
  { name: 'About', href: '#about' },
  { name: 'Contact', href: '#contact' },
]

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const { user, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    await signOut()
    setIsUserMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'py-3 bg-imperial-navy/90 backdrop-blur-xl border-b border-radiant-gold/10'
          : 'py-4 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="#home"
            className="flex items-center"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <img 
              src="/logo.png" 
              alt="AmaduTown" 
              className="object-contain"
              style={{ width: 'auto', height: '60px' }}
            />
          </motion.a>

          {/* Right side: Auth + Hamburger */}
          <div className="flex items-center gap-4">
            {/* Auth Section */}
            {user ? (
              <div className="relative user-menu-container">
                <motion.button
                  onClick={() => {
                    setIsUserMenuOpen(!isUserMenuOpen)
                    // Close nav menu when opening user menu
                    if (!isUserMenuOpen) setIsMenuOpen(false)
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-3 px-4 py-2 rounded-full glass-card border border-radiant-gold/30 hover:border-radiant-gold/60 transition-all duration-300"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-bronze via-radiant-gold to-gold-light flex items-center justify-center text-imperial-navy font-heading font-bold text-sm">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  {/* Name/Email - hidden on mobile */}
                  <span className="hidden sm:block text-platinum-white/80 text-sm font-medium max-w-[120px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                  {/* Admin badge */}
                  {isAdmin && (
                    <Shield className="text-radiant-gold" size={14} />
                  )}
                </motion.button>

                {/* User Dropdown */}
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-3 w-64 glass-card border border-radiant-gold/20 rounded-xl overflow-hidden shadow-2xl z-[60]"
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
                          href="/lead-magnets"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-platinum-white/80 hover:text-radiant-gold hover:bg-radiant-gold/10 rounded-lg transition-all duration-200"
                        >
                          <Download size={16} />
                          Lead Magnets
                        </a>

                        <a
                          href="/purchases"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-platinum-white/80 hover:text-radiant-gold hover:bg-radiant-gold/10 rounded-lg transition-all duration-200"
                        >
                          <User size={16} />
                          My Purchases
                        </a>

                        {isAdmin && (
                          <a
                            href="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
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
            ) : (
              <motion.a
                href="/auth/login"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-5 py-2 rounded-full border border-radiant-gold/40 text-radiant-gold hover:bg-radiant-gold hover:text-imperial-navy text-sm font-heading tracking-wider uppercase transition-all duration-300"
              >
                <User size={16} />
                <span className="hidden sm:inline">Login</span>
              </motion.a>
            )}

            {/* Hamburger Menu Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsMenuOpen(!isMenuOpen)
                // Close user menu when opening nav menu
                if (!isMenuOpen) setIsUserMenuOpen(false)
              }}
              className="flex items-center justify-center w-11 h-11 rounded-full glass-card border border-radiant-gold/30 hover:border-radiant-gold/60 text-platinum-white hover:text-radiant-gold transition-all duration-300"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait">
                {isMenuOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X size={20} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu size={20} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Full Navigation Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute top-full left-0 right-0 bg-imperial-navy/95 backdrop-blur-xl border-b border-radiant-gold/10 overflow-hidden z-[40]"
          >
            <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-8">
              {/* Navigation Links Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.name}
                    href={item.href}
                    onClick={() => {
                      analytics.navClick(item.href)
                      setIsMenuOpen(false)
                    }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative px-4 py-3 rounded-xl text-platinum-white/70 hover:text-radiant-gold hover:bg-radiant-gold/5 transition-all duration-300"
                  >
                    <span className="text-sm font-medium tracking-wide">{item.name}</span>
                    <span className="absolute bottom-2 left-4 right-4 h-[1px] bg-radiant-gold/0 group-hover:bg-radiant-gold/40 transition-all duration-300" />
                  </motion.a>
                ))}
              </div>

              {/* CTA Section */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 pt-6 border-t border-radiant-gold/10 flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <p className="text-platinum-white/50 text-sm">
                  Ready to collaborate?
                </p>
                <motion.a
                  href="#contact"
                  onClick={() => setIsMenuOpen(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-gold text-sm tracking-wider uppercase"
                >
                  Get in Touch
                </motion.a>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
