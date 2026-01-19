'use client'

import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { useEffect, useState } from 'react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
}

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // All roles/titles as pills
  const allRoles = [
    'Director, Product Strategy',
    'AI Automations specialist',
    'Author',
    'Lyricist',
    'Founder',
  ]

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <section
      id="home"
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black"
    >
      {/* Professional gradient background */}
      <div className="absolute inset-0">
        {/* Base dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900" />
        
        {/* Subtle accent gradient that follows mouse */}
        <div
          className="absolute inset-0 opacity-20 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)`,
          }}
        />
        
        {/* Subtle mesh pattern overlay */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center z-10 px-4 relative"
      >
        {/* Profile Image */}
        <motion.div
          variants={itemVariants}
          className="mb-8 flex justify-center"
        >
          <motion.div
            className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-purple-500/30 shadow-2xl bg-gray-900"
            whileHover={{ scale: 1.05 }}
            style={{
              boxShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
            }}
          >
            <img
              src="/Profile Photo.png"
              alt="Vambah Sillah"
              className="w-full h-full object-cover"
              style={{ 
                objectPosition: 'center',
                filter: 'contrast(1.1) brightness(0.95)'
              }}
              onError={(e) => {
                e.currentTarget.src = '/V Profile_Replicate.jpg'
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20" />
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
            whileHover={{ scale: 1.02 }}
          >
            <span className="text-white">Vambah Sillah</span>
          </motion.h1>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-lg md:text-xl lg:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
        >
          IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers.
        </motion.p>

        <motion.div 
          variants={itemVariants}
          className="flex flex-wrap justify-center gap-3 md:gap-4 mb-10"
        >
          {allRoles.map((role, index) => (
            <motion.div
              key={role}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1, ease: 'easeOut' }}
              className="px-4 py-2 md:px-6 md:py-2.5 rounded-full bg-gray-900/95 backdrop-blur-sm border border-purple-500/60 shadow-lg hover:border-purple-400/80 hover:bg-gray-800/95 transition-all cursor-default"
              style={{
                background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.98) 50%, rgba(17, 24, 39, 0.98) 100%)',
                boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.25)',
              }}
              whileHover={{ scale: 1.05, y: -2 }}
            >
              <span 
                className="text-sm md:text-base font-semibold bg-gradient-to-r from-purple-300 via-pink-400 to-rose-400 bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #c4b5fd 0%, #f472b6 50%, #fb7185 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'brightness(1.1)',
                }}
              >
                {role}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-4">
          <motion.a
            href="#projects"
            className="inline-block px-8 py-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-white font-medium hover:border-blue-500/50 hover:bg-gray-800/80 transition-all relative overflow-hidden group cursor-pointer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="relative z-10">Explore My Work</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100"
              transition={{ duration: 0.3 }}
            />
          </motion.a>
          
          <motion.a
            href="#contact"
            className="inline-block px-8 py-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg text-white font-medium hover:border-pink-500/50 hover:bg-gray-800/80 transition-all relative overflow-hidden group cursor-pointer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="relative z-10">Contact Me</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100"
              transition={{ duration: 0.3 }}
            />
          </motion.a>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ArrowDown className="text-gray-500" size={24} />
      </motion.div>
    </section>
  )
}

