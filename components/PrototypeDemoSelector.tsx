'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Play, Monitor, Video as VideoIcon } from 'lucide-react'

interface Demo {
  id: string
  title: string
  description: string | null
  demo_type: string
  demo_url: string
  persona_type: string | null
  journey_focus: string | null
  is_primary: boolean
  display_order: number
}

interface PrototypeDemoSelectorProps {
  demos: Demo[]
  prototypeId: string
  onDemoChange?: (demoId: string) => void
}

export default function PrototypeDemoSelector({
  demos,
  prototypeId,
  onDemoChange,
}: PrototypeDemoSelectorProps) {
  // Find primary demo or use first demo
  const primaryDemo = demos.find(d => d.is_primary) || demos[0]
  const [selectedDemoId, setSelectedDemoId] = useState(primaryDemo?.id || '')
  const [isOpen, setIsOpen] = useState(false)

  // Load persisted demo selection on mount
  useEffect(() => {
    if (!demos || demos.length === 0) return
    
    if (typeof window !== 'undefined' && prototypeId) {
      const saved = sessionStorage.getItem(`prototype_demo_${prototypeId}`)
      if (saved && demos.find(d => d.id === saved)) {
        setSelectedDemoId(saved)
      } else if (primaryDemo?.id) {
        setSelectedDemoId(primaryDemo.id)
      }
    } else if (primaryDemo?.id) {
      setSelectedDemoId(primaryDemo.id)
    }
  }, [prototypeId, primaryDemo?.id, demos])

  // Get current selected demo
  const selectedDemo = demos.find(d => d.id === selectedDemoId) || primaryDemo

  // Sort demos by display_order
  const sortedDemos = [...demos].sort((a, b) => a.display_order - b.display_order)

  const handleDemoSelect = (demoId: string) => {
    setSelectedDemoId(demoId)
    setIsOpen(false)
    if (onDemoChange) {
      onDemoChange(demoId)
    }
    // Store in sessionStorage for persistence
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`prototype_demo_${prototypeId}`, demoId)
    }
  }

  if (!selectedDemo) return null

  const getDemoIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <VideoIcon size={16} />
      case 'interactive':
        return <Monitor size={16} />
      default:
        return <Play size={16} />
    }
  }

  return (
    <div className="space-y-4">
      {/* Demo Selector Dropdown (if multiple demos) */}
      {demos.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              {getDemoIcon(selectedDemo.demo_type)}
              <span className="text-sm font-medium">{selectedDemo.title}</span>
              {selectedDemo.persona_type && (
                <span className="text-xs text-gray-400">({selectedDemo.persona_type})</span>
              )}
            </div>
            <ChevronDown 
              size={16} 
              className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto"
              >
                {sortedDemos.map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => handleDemoSelect(demo.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800 transition-colors border-b border-gray-800 last:border-b-0 ${
                      selectedDemoId === demo.id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {getDemoIcon(demo.demo_type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">{demo.title}</span>
                          {demo.is_primary && (
                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">
                              Primary
                            </span>
                          )}
                        </div>
                        {demo.description && (
                          <p className="text-xs text-gray-400 mb-1">{demo.description}</p>
                        )}
                        {demo.persona_type && (
                          <span className="text-xs text-gray-500">Persona: {demo.persona_type}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Demo Display */}
      <div className="relative">
        {selectedDemo.demo_type === 'video' ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-black">
            {selectedDemo.demo_url.includes('youtube.com') || selectedDemo.demo_url.includes('youtu.be') ? (
              <iframe
                src={selectedDemo.demo_url.replace(/watch\?v=/, 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={selectedDemo.demo_url}
                className="w-full h-full"
                controls
              />
            )}
          </div>
        ) : selectedDemo.demo_type === 'interactive' ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-black border border-gray-800">
            <iframe
              src={selectedDemo.demo_url}
              className="w-full h-full"
              allow="fullscreen"
            />
          </div>
        ) : (
          <a
            href={selectedDemo.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 hover:border-purple-500/50 transition-colors flex items-center justify-center group"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 bg-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={24} className="text-white ml-1" fill="white" />
              </div>
              <p className="text-white font-medium">View Demo</p>
              <p className="text-sm text-gray-400 mt-1">{selectedDemo.demo_url}</p>
            </div>
          </a>
        )}

        {/* Demo Info */}
        {selectedDemo.journey_focus && (
          <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
            <span className="font-medium">Journey Focus:</span> {selectedDemo.journey_focus}
          </div>
        )}
      </div>
    </div>
  )
}
