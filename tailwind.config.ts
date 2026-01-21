import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // AmaduTown Brand Colors
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'imperial-navy': '#121E31',
        'radiant-gold': '#D4AF37',
        'silicon-slate': '#2C3E50',
        'platinum-white': '#EAECEE',
        'bronze': '#8B6914',
        'gold-light': '#F5D060',
      },
      // Brand Typography
      fontFamily: {
        heading: ['var(--font-orbitron)', 'sans-serif'],
        premium: ['var(--font-cormorant)', 'serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      // Brand Animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'mask-up': 'maskUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'aurora-drift': 'auroraDrift 20s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.5s ease-out',
        'flow-path': 'flowPath 20s ease-in-out infinite',
        'pulse-node': 'pulseNode 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        maskUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        auroraDrift: {
          '0%': { transform: 'translate(-10%, -10%) scale(1)' },
          '100%': { transform: 'translate(10%, 10%) scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        flowPath: {
          '0%, 100%': { strokeDashoffset: '1000' },
          '50%': { strokeDashoffset: '0' },
        },
        pulseNode: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.3)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      // Brand Box Shadows
      boxShadow: {
        'gold-glow': '0 0 20px rgba(212, 175, 55, 0.3)',
        'gold-glow-lg': '0 0 40px rgba(212, 175, 55, 0.4)',
        'gold-glow-sm': '0 0 10px rgba(212, 175, 55, 0.2)',
      },
    },
  },
  plugins: [],
}
export default config

