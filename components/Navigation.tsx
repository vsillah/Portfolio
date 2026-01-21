'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { analytics } from '@/lib/analytics'
import UserMenu from '@/components/auth/UserMenu'
import { useAuth } from '@/components/AuthProvider'

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
  const { user } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? 'py-3 bg-imperial-navy/80 backdrop-blur-xl border-b border-radiant-gold/10'
          : 'py-6 bg-transparent'
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
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </motion.a>

          {/* Desktop Navigation - Centered & Refined */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.slice(0, 5).map((item) => (
              <motion.a
                key={item.name}
                href={item.href}
                className="relative text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors group"
              >
                {item.name}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-radiant-gold transition-all duration-300 group-hover:w-full" />
              </motion.a>
            ))}
          </div>

          {/* Right side: Auth + Action */}
          <div className="flex items-center gap-6">
            {!user && (
              <motion.a
                href="/auth/login"
                className="hidden sm:block text-[10px] font-heading tracking-[0.2em] uppercase text-platinum-white/60 hover:text-platinum-white transition-colors"
              >
                Login
              </motion.a>
            )}
            
            <motion.a
              href="#contact"
              className="hidden lg:flex px-6 py-2 border border-radiant-gold/30 rounded-full text-[10px] font-heading tracking-[0.2em] uppercase text-radiant-gold hover:bg-radiant-gold hover:text-imperial-navy transition-all duration-300"
            >
              Contact Us
            </motion.a>
            
            {/* Hamburger */}
            <motion.button
              className="text-platinum-white/80 hover:text-radiant-gold lg:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="bg-silicon-slate/98 backdrop-blur-md border-t border-radiant-gold/10 lg:hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.name}
                    href={item.href}
                    className="block py-3 px-4 text-platinum-white/80 hover:text-radiant-gold hover:bg-imperial-navy/50 rounded-lg transition-all"
                    onClick={() => {
                      analytics.navClick(item.href)
                      setIsMenuOpen(false)
                    }}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <span className="text-sm font-medium">{item.name}</span>
                  </motion.a>
                ))}
              </div>
              
              {/* User Menu for Mobile */}
              <div className="mt-6 pt-6 border-t border-radiant-gold/10 flex flex-col gap-3">
                {user ? (
                  <UserMenu />
                ) : (
                  <>
                    <motion.a
                      href="/auth/login"
                      className="btn-ghost text-center text-sm"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Login
                    </motion.a>
                    <motion.a
                      href="#contact"
                      className="btn-gold text-center text-sm"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      GET STARTED
                    </motion.a>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}

