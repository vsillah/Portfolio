'use client'

import { useEffect, useState } from 'react'

interface FlowingMeshProps {
  className?: string
  opacity?: number
}

export default function FlowingMesh({ className = '', opacity = 1 }: FlowingMeshProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMaxYMid slice"
        style={{ opacity }}
      >
        <defs>
          {/* Gold Glow Filter */}
          <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Stronger Glow for Nodes */}
          <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient for paths */}
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B6914" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F5D060" stopOpacity="0.6" />
          </linearGradient>

          {/* Radial gradient for ambient glow */}
          <radialGradient id="ambientGlow" cx="70%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient background glow */}
        <ellipse
          cx="900"
          cy="400"
          rx="400"
          ry="350"
          fill="url(#ambientGlow)"
          className="animate-glow-pulse"
        />

        {/* Circuit Path 1 - Main flowing curve */}
        <path
          d="M 1200 50 Q 1000 150, 950 300 T 1050 550 Q 1100 650, 1000 750"
          stroke="url(#goldGradient)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path"
          style={{ animationDelay: '0s' }}
        />

        {/* Circuit Path 2 - Secondary curve */}
        <path
          d="M 1150 0 Q 900 100, 850 250 T 900 450 Q 950 550, 850 700 T 900 800"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.5"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path"
          style={{ animationDelay: '3s' }}
        />

        {/* Circuit Path 3 - Accent curve */}
        <path
          d="M 1100 100 Q 950 200, 1000 350 T 950 500"
          stroke="#D4AF37"
          strokeWidth="1.2"
          strokeOpacity="0.6"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path-reverse"
          style={{ animationDelay: '5s' }}
        />

        {/* Circuit Path 4 - Lower curve */}
        <path
          d="M 800 400 Q 900 450, 950 550 T 1100 700 Q 1150 750, 1200 720"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.4"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path"
          style={{ animationDelay: '7s' }}
        />

        {/* Circuit Path 5 - Upper connecting line */}
        <path
          d="M 950 150 L 1050 200 Q 1100 250, 1080 320"
          stroke="#D4AF37"
          strokeWidth="1"
          strokeOpacity="0.5"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path-reverse"
          style={{ animationDelay: '2s' }}
        />

        {/* Circuit Path 6 - Diagonal accent */}
        <path
          d="M 1200 300 Q 1100 350, 1050 450 L 1000 500"
          stroke="#F5D060"
          strokeWidth="0.8"
          strokeOpacity="0.4"
          fill="none"
          filter="url(#goldGlow)"
          className="circuit-path"
          style={{ animationDelay: '10s' }}
        />

        {/* Circuit Nodes - Primary */}
        <g filter="url(#nodeGlow)">
          {/* Node 1 */}
          <circle
            cx="950"
            cy="300"
            r="5"
            fill="#D4AF37"
            className="circuit-node"
            style={{ animationDelay: '0s' }}
          />
          {/* Node 2 */}
          <circle
            cx="1050"
            cy="550"
            r="4"
            fill="#D4AF37"
            className="circuit-node"
            style={{ animationDelay: '1s' }}
          />
          {/* Node 3 */}
          <circle
            cx="850"
            cy="250"
            r="4"
            fill="#F5D060"
            className="circuit-node"
            style={{ animationDelay: '2s' }}
          />
          {/* Node 4 */}
          <circle
            cx="900"
            cy="450"
            r="5"
            fill="#D4AF37"
            className="circuit-node"
            style={{ animationDelay: '0.5s' }}
          />
          {/* Node 5 */}
          <circle
            cx="1000"
            cy="350"
            r="3"
            fill="#F5D060"
            className="circuit-node"
            style={{ animationDelay: '1.5s' }}
          />
          {/* Node 6 */}
          <circle
            cx="950"
            cy="500"
            r="4"
            fill="#D4AF37"
            className="circuit-node"
            style={{ animationDelay: '2.5s' }}
          />
          {/* Node 7 */}
          <circle
            cx="1100"
            cy="700"
            r="3"
            fill="#D4AF37"
            className="circuit-node"
            style={{ animationDelay: '3s' }}
          />
          {/* Node 8 */}
          <circle
            cx="1050"
            cy="200"
            r="4"
            fill="#F5D060"
            className="circuit-node"
            style={{ animationDelay: '0.8s' }}
          />
        </g>

        {/* Secondary smaller nodes for depth */}
        <g opacity="0.5">
          <circle cx="920" cy="380" r="2" fill="#D4AF37" className="circuit-node" style={{ animationDelay: '4s' }} />
          <circle cx="1020" cy="420" r="2" fill="#D4AF37" className="circuit-node" style={{ animationDelay: '5s' }} />
          <circle cx="880" cy="520" r="2" fill="#F5D060" className="circuit-node" style={{ animationDelay: '6s' }} />
          <circle cx="1080" cy="480" r="2" fill="#D4AF37" className="circuit-node" style={{ animationDelay: '7s' }} />
          <circle cx="970" cy="620" r="2" fill="#F5D060" className="circuit-node" style={{ animationDelay: '8s' }} />
        </g>
      </svg>

      {/* Additional ambient glow layer */}
      <div 
        className="absolute top-0 right-0 w-3/4 h-full"
        style={{
          background: 'radial-gradient(ellipse at 80% 50%, rgba(212,175,55,0.08) 0%, transparent 60%)',
        }}
      />
    </div>
  )
}
