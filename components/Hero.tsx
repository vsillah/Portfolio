'use client'

import { motion, useScroll, useTransform, useReducedMotion, type MotionStyle } from 'framer-motion'
import { ArrowRight, ArrowDown, Sparkles, Brain, Rocket, Music, Heart, Building2, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import Link from 'next/link'
import { MagneticButton } from './ui/MagneticButton'

const MISSION_CARDS = [
  { id: 'community', label: 'Community', line: 'Free or at-cost for nonprofits—we give back.', img: '/mission-community.png', alt: 'Illustration: community and giving back to nonprofits.', Icon: Heart },
  { id: 'funding', label: 'Funding', line: 'Mid-size and larger organizations help make it possible.', img: '/mission-partners.png', alt: 'Illustration: partnership and growth with organizations.', Icon: Building2 },
  { id: 'dogfooding', label: 'Dogfooding', line: 'We use our own tools; improvements flow to everyone.', img: '/mission-tools.png', alt: 'Illustration: feedback loop of using our own tools.', Icon: RefreshCw },
]

const FloatingCard = ({ children, delay = 0, x = 0, y = 0, className = "" }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ 
      opacity: 1, 
      y: [y, y - 15, y],
      x: [x, x + 5, x]
    }}
    transition={{ 
      opacity: { duration: 0.8, delay },
      y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
      x: { duration: 4, repeat: Infinity, ease: "easeInOut", delay }
    }}
    className={`absolute hidden lg:flex glass-card items-center gap-3 px-4 py-3 z-20 ${className}`}
  >
    {children}
  </motion.div>
)

// Animated Circuit Line component
const CircuitLine = ({ d, delay = 0, duration = 8 }: { d: string, delay?: number, duration?: number }) => (
  <motion.path
    d={d}
    stroke="url(#heroGoldGradient)"
    strokeWidth="1"
    fill="none"
    initial={{ pathLength: 0, opacity: 0 }}
    animate={{ 
      pathLength: [0, 1, 1, 0],
      opacity: [0, 0.6, 0.6, 0]
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />
)

// Pulsing Node component
const PulsingNode = ({ cx, cy, delay = 0 }: { cx: number, cy: number, delay?: number }) => (
  <motion.circle
    cx={cx}
    cy={cy}
    r="3"
    fill="#D4AF37"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: [0, 1.5, 1, 1.5, 0],
      opacity: [0, 0.8, 0.4, 0.8, 0]
    }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />
)

function MissionCard({
  index,
  label,
  line,
  img,
  alt,
  Icon,
  motionStyle,
  reduceMotion,
}: {
  index: number
  label: string
  line: string
  img: string
  alt: string
  Icon: React.ComponentType<{ className?: string }>
  motionStyle: MotionStyle
  reduceMotion: boolean
}) {
  return (
    <motion.div
      className="glass-card border border-radiant-gold/20 rounded-2xl overflow-hidden origin-center"
      style={reduceMotion ? {} : motionStyle}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0.2 : 0.6,
        delay: reduceMotion ? 0 : index * 0.1,
      }}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-imperial-navy flex items-center justify-center">
        <Icon className="w-14 h-14 sm:w-16 sm:h-16 text-radiant-gold/30" aria-hidden />
        <span className="sr-only">{alt}</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-heading uppercase tracking-[0.2em] text-radiant-gold mb-1.5">{label}</p>
        <p className="font-body text-sm sm:text-base text-platinum-white/80 leading-snug">{line}</p>
      </div>
    </motion.div>
  )
}

export default function Hero() {
  const containerRef = useRef(null)
  const reduceMotion = useReducedMotion() ?? false
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.95])

  // Stacked-at-start → fan-out-on-scroll: at 0 cards overlap at center; by 0.15 they're in a row
  const card0X = useTransform(scrollYProgress, [0, 0.15], ['100%', '0%'])   // left: move right to center when stacked
  const card2X = useTransform(scrollYProgress, [0, 0.15], ['-100%', '0%'])  // right: move left to center when stacked
  const card0Y = useTransform(scrollYProgress, [0, 0.15], [8, 0])          // back of deck
  const card1Y = useTransform(scrollYProgress, [0, 0.15], [4, 0])          // middle
  const card2Y = useTransform(scrollYProgress, [0, 0.15], [0, 0])         // front of deck
  const card0Rotate = useTransform(scrollYProgress, [0, 0.15], [-2, 0])
  const card2Rotate = useTransform(scrollYProgress, [0, 0.15], [2, 0])
  const missionCardStyles = [
    { x: card0X, y: card0Y, rotate: card0Rotate, zIndex: 0 },
    { y: card1Y, zIndex: 1 },
    { x: card2X, y: card2Y, rotate: card2Rotate, zIndex: 2 },
  ]

  return (
    <section
      ref={containerRef}
      id="home"
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-imperial-navy pt-20"
    >
      {/* Dynamic Circuit Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="heroGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B6914" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#F5D060" stopOpacity="0.3" />
            </linearGradient>
            <filter id="heroGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="1" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>
          </defs>
          
          {/* Animated Circuit Lines */}
          <g filter="url(#heroGlow)">
            {/* Top-left circuits */}
            <CircuitLine d="M 0 200 Q 200 180, 350 300 T 500 250" delay={0} duration={6} />
            <CircuitLine d="M 100 0 L 100 150 Q 100 200, 200 250 L 350 250" delay={1} duration={7} />
            <CircuitLine d="M 0 400 Q 150 380, 250 450 T 400 400" delay={2} duration={8} />
            
            {/* Top-right circuits */}
            <CircuitLine d="M 1920 150 Q 1700 180, 1550 280 T 1400 200" delay={0.5} duration={7} />
            <CircuitLine d="M 1800 0 L 1800 120 Q 1800 180, 1650 220 L 1500 220" delay={1.5} duration={6} />
            <CircuitLine d="M 1920 350 Q 1750 320, 1600 400 T 1450 350" delay={2.5} duration={8} />
            
            {/* Bottom-left circuits */}
            <CircuitLine d="M 0 800 Q 200 820, 350 720 T 500 780" delay={3} duration={7} />
            <CircuitLine d="M 150 1080 L 150 900 Q 150 850, 280 800 L 400 800" delay={1} duration={8} />
            
            {/* Bottom-right circuits */}
            <CircuitLine d="M 1920 850 Q 1700 820, 1550 900 T 1400 850" delay={2} duration={6} />
            <CircuitLine d="M 1750 1080 L 1750 920 Q 1750 870, 1600 830 L 1500 830" delay={3.5} duration={7} />
          </g>
          
          {/* Pulsing Nodes at circuit intersections */}
          <g>
            <PulsingNode cx={350} cy={300} delay={0} />
            <PulsingNode cx={200} cy={250} delay={0.5} />
            <PulsingNode cx={400} cy={400} delay={1} />
            <PulsingNode cx={1550} cy={280} delay={1.5} />
            <PulsingNode cx={1650} cy={220} delay={2} />
            <PulsingNode cx={1600} cy={400} delay={2.5} />
            <PulsingNode cx={350} cy={720} delay={3} />
            <PulsingNode cx={280} cy={800} delay={3.5} />
            <PulsingNode cx={1550} cy={900} delay={4} />
            <PulsingNode cx={1600} cy={830} delay={4.5} />
          </g>
        </svg>
      </div>

      {/* Ambient Auroras */}
      <div className="aurora-container">
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
      </div>

      {/* Hero Content - Centered Editorial Layout */}
      <motion.div 
        style={{ y, opacity, scale }}
        className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center"
      >
        {/* Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-6 flex justify-center"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/30">
            <Sparkles className="w-3.5 h-3.4 text-radiant-gold" />
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-heading text-platinum-white/80">
              AmaduTown Advisory Solutions
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <div className="overflow-hidden mb-4">
          <motion.h1 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="font-premium text-5xl sm:text-7xl lg:text-8xl text-platinum-white leading-[1.1] tracking-tight"
          >
            Digital Excellence <br className="hidden sm:block" />
            <span className="italic text-radiant-gold">for Community Impact</span>
          </motion.h1>
        </div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="font-body text-base sm:text-lg text-platinum-white/60 mb-8 max-w-2xl mx-auto leading-relaxed"
        >
          Empowering minority-owned businesses and nonprofits with data-driven strategy, 
          AI automation, and full-spectrum digital support.
        </motion.p>

        {/* Mission cards — scroll fan-out + parallax */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-4xl mx-auto mb-10 sm:mb-12"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } },
            hidden: {},
          }}
        >
          {MISSION_CARDS.map((card, index) => (
            <MissionCard
              key={card.id}
              index={index}
              label={card.label}
              line={card.line}
              img={card.img}
              alt={card.alt}
              Icon={card.Icon}
              motionStyle={reduceMotion ? {} : missionCardStyles[index]}
              reduceMotion={!!reduceMotion}
            />
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16"
        >
          <MagneticButton>
            <a
              href="#contact"
              className="btn-gold group flex items-center gap-3 px-8 py-4 rounded-full text-sm font-heading tracking-widest"
            >
              <span>GET STARTED</span>
              <div className="bg-imperial-navy rounded-full p-1 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-3 h-3 text-radiant-gold" />
              </div>
            </a>
          </MagneticButton>
          
          <Link
            href="/pricing"
            className="text-platinum-white/80 hover:text-platinum-white text-xs font-heading tracking-widest transition-colors border-b border-platinum-white/20 pb-1"
          >
            VIEW PRICING
          </Link>
          
          <a
            href="#projects"
            className="text-platinum-white/80 hover:text-platinum-white text-xs font-heading tracking-widest transition-colors border-b border-platinum-white/20 pb-1"
          >
            EXPLORE WORK
          </a>
        </motion.div>

        {/* Main Visual - Brand Shield with Dynamic Glow */}
        <div className="relative max-w-[320px] sm:max-w-[400px] mx-auto group">
          {/* Floating Micro-Cards */}
          <FloatingCard delay={0.2} x={-200} y={-60} className="left-0">
            <div className="p-2 bg-radiant-gold/20 rounded-lg">
              <Brain className="w-4 h-4 text-radiant-gold" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-platinum-white/40 uppercase tracking-tighter">Focus</p>
              <p className="text-xs font-semibold text-platinum-white whitespace-nowrap">AI Strategy</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.5} x={200} y={20} className="right-0">
            <div className="p-2 bg-radiant-gold/20 rounded-lg">
              <Rocket className="w-4 h-4 text-radiant-gold" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-platinum-white/40 uppercase tracking-tighter">Method</p>
              <p className="text-xs font-semibold text-platinum-white whitespace-nowrap">Agile Growth</p>
            </div>
          </FloatingCard>

          <FloatingCard delay={0.8} x={-160} y={140} className="left-0">
            <div className="p-2 bg-radiant-gold/20 rounded-lg">
              <Music className="w-4 h-4 text-radiant-gold" />
            </div>
            <div className="text-left">
              <p className="text-[10px] text-platinum-white/40 uppercase tracking-tighter">Creative</p>
              <p className="text-xs font-semibold text-platinum-white whitespace-nowrap">Mad Hadda</p>
            </div>
          </FloatingCard>

          {/* Brand Wallpaper Visual */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="relative"
          >
            {/* Outer Ambient Glow - Large & Intense */}
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.7, 0.4]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(circle, rgba(212,175,55,0.6) 0%, rgba(245,208,96,0.3) 30%, rgba(139,105,20,0.2) 50%, transparent 70%)',
                transform: 'scale(2.2)',
                filter: 'blur(50px)'
              }}
            />
            
            {/* Inner Circuit Glow - Pulsing & Brighter */}
            <motion.div
              animate={{ 
                opacity: [0.5, 0.9, 0.5],
                scale: [1, 1.08, 1]
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(circle, rgba(212,175,55,0.7) 0%, rgba(245,208,96,0.4) 30%, transparent 55%)',
                transform: 'scale(1.6)',
                filter: 'blur(25px)'
              }}
            />
            
            {/* Core Glow - Tight & Bright */}
            <motion.div
              animate={{ 
                opacity: [0.6, 1, 0.6],
                scale: [0.95, 1.02, 0.95]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(circle, rgba(245,208,96,0.5) 0%, rgba(212,175,55,0.3) 40%, transparent 60%)',
                transform: 'scale(1.2)',
                filter: 'blur(15px)'
              }}
            />

            {/* Laser Beam Border Effect */}
            <div className="absolute -inset-[2px] rounded-3xl overflow-hidden -z-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, transparent 70%, rgba(212,175,55,0.8) 75%, rgba(245,208,96,1) 80%, rgba(212,175,55,0.8) 85%, transparent 90%, transparent 100%)',
                }}
              />
              {/* Inner mask to show only the border */}
              <div className="absolute inset-[2px] rounded-3xl bg-imperial-navy" />
            </div>
            
            {/* Secondary Laser Trail */}
            <div className="absolute -inset-[2px] rounded-3xl overflow-hidden -z-5">
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from 180deg, transparent 0%, transparent 80%, rgba(139,105,20,0.6) 85%, rgba(212,175,55,0.8) 88%, rgba(139,105,20,0.6) 91%, transparent 95%, transparent 100%)',
                }}
              />
              <div className="absolute inset-[2px] rounded-3xl bg-imperial-navy" />
            </div>

            {/* Wallpaper Container */}
            <div className="relative aspect-square rounded-3xl overflow-hidden border-2 border-radiant-gold/30 shadow-2xl">
              {/* Wallpaper Image */}
              <motion.img
                src="/wallpaper.png"
                alt="AmaduTown Brand Visual"
                className="w-full h-full object-cover"
                animate={{
                  filter: [
                    'brightness(1.05) contrast(1.05)',
                    'brightness(1.2) contrast(1.1)',
                    'brightness(1.05) contrast(1.05)'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* AT Logo Glow Overlay - Stronger */}
              <motion.div
                className="absolute inset-0 pointer-events-none mix-blend-screen"
                animate={{ opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background: 'radial-gradient(circle at 50% 45%, rgba(212,175,55,0.6) 0%, rgba(245,208,96,0.3) 25%, transparent 50%)'
                }}
              />
              
              {/* Secondary Logo Pulse */}
              <motion.div
                className="absolute inset-0 pointer-events-none mix-blend-overlay"
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                style={{
                  background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.3) 0%, transparent 40%)'
                }}
              />
              
              {/* Scanline Effect for Tech Feel */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-[0.02]"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.15) 2px, rgba(212,175,55,0.15) 4px)'
                }}
              />
              
              {/* Vignette - Lighter */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(18,30,49,0.5) 100%)'
                }}
              />
            </div>
            
            {/* Corner Accent Glows - Brighter */}
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-6 -left-6 w-32 h-32 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(245,208,96,0.6) 0%, rgba(212,175,55,0.3) 50%, transparent 70%)' }}
            />
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(circle, rgba(245,208,96,0.6) 0%, rgba(212,175,55,0.3) 50%, transparent 70%)' }}
            />
            
            {/* Additional corner accents */}
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-xl"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%)' }}
            />
            <motion.div
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
              className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full blur-xl"
              style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.5) 0%, transparent 70%)' }}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Decorative Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-imperial-navy to-transparent pointer-events-none z-20" />
      
      {/* Scroll Hint */}
      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 opacity-30"
      >
        <ArrowDown className="w-5 h-5 text-platinum-white" />
      </motion.div>
    </section>
  )
}

