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

// Starfield particle component
const Star = ({ index }: { index: number }) => {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
  }, [])

  const startX = Math.random() * dimensions.width
  const startY = Math.random() * dimensions.height
  const endX = startX + (Math.random() - 0.5) * 400
  const endY = startY + (Math.random() - 0.5) * 400
  const duration = 2 + Math.random() * 3
  const delay = Math.random() * 2
  const size = 1 + Math.random() * 2
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
  const color = colors[Math.floor(Math.random() * colors.length)]

  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        left: `${startX}px`,
        top: `${startY}px`,
      }}
      animate={{
        x: [0, endX - startX],
        y: [0, endY - startY],
        opacity: [0, 1, 0.8, 0],
        scale: [0, 1, 1.2, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: 'linear',
      }}
    />
  )
}

// Streaking trail effect
const Streak = ({ index }: { index: number }) => {
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 })
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
  }, [])

  const startX = Math.random() * dimensions.width
  const startY = Math.random() * dimensions.height
  const angle = Math.random() * Math.PI * 2
  const length = 100 + Math.random() * 200
  const endX = startX + Math.cos(angle) * length
  const endY = startY + Math.sin(angle) * length
  const duration = 1 + Math.random() * 2
  const delay = Math.random() * 3
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899']
  const color = colors[Math.floor(Math.random() * colors.length)]

  return (
    <motion.line
      x1={startX}
      y1={startY}
      x2={endX}
      y2={endY}
      stroke={color}
      strokeWidth="1"
      opacity={0.6}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{
        pathLength: [0, 1, 0],
        opacity: [0, 0.8, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    />
  )
}

export default function Hero() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // All roles/titles as pills
  const allRoles = [
    'Director of Product Strategy at a Fortune 500 Company',
    'AI Automations specialist',
    'Author',
    'Hip Hop Artist',
    'Co-Founder of AmaduTown Advisory Solutions',
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
      {/* Animated starfield background */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(59, 130, 246, 0.4) 0%, rgba(139, 92, 246, 0.3) 30%, rgba(236, 72, 153, 0.2) 60%, transparent 100%)`,
          }}
        />
        
        {/* Animated stars */}
        {typeof window !== 'undefined' && [...Array(50)].map((_, i) => (
          <Star key={i} index={i} />
        ))}
        
        {/* Streaking trails */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          {typeof window !== 'undefined' && [...Array(15)].map((_, i) => (
            <Streak key={i} index={i} />
          ))}
        </svg>
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

