'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Code2, Download } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import ExpandableText from '@/components/ui/ExpandableText'

interface Project {
  id: number
  title: string
  description: string | null
  github: string | null
  live: string | null
  image: string | null
  technologies: string[]
  display_order: number
  is_published: boolean
  file_path: string | null
  file_type: string | null
  file_size: number | null
}

const ProjectCard = ({ project, index }: { project: Project, index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 flex flex-col hover:-translate-y-2 shadow-2xl"
    >
      {/* Mouse Tracking Glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(212, 175, 55, 0.08), transparent 40%)`
        }}
      />

      {/* Project Image */}
      <div className="relative h-56 overflow-hidden flex-shrink-0">
        <img
          src={project.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[40%] group-hover:grayscale-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-silicon-slate via-transparent to-transparent opacity-60" />
      </div>

      {/* Project Content */}
      <div className="p-8 flex flex-col flex-grow relative z-10">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-premium text-2xl font-medium text-platinum-white group-hover:text-radiant-gold transition-colors">
            {project.title}
          </h3>
          <Code2 className="text-radiant-gold/40 flex-shrink-0" size={20} />
        </div>

        {/* Expandable Description */}
        {project.description && (
          <ExpandableText
            text={project.description}
            maxHeight={80}
            className="font-body text-platinum-white/50 text-sm leading-relaxed mb-6"
            expandButtonColor="text-radiant-gold hover:text-gold-light"
          />
        )}

        {/* Tech Stack */}
        <div className="flex flex-wrap gap-2 mb-8">
          {project.technologies && project.technologies.map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 text-[10px] font-heading tracking-wider bg-imperial-navy/50 text-radiant-gold/60 rounded-full border border-radiant-gold/10"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Links */}
        <div className="flex gap-6 items-center pt-6 border-t border-radiant-gold/5">
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-heading tracking-widest text-platinum-white/40 hover:text-radiant-gold transition-colors flex items-center gap-2"
            >
              DETAILS
            </a>
          )}
          {project.live && (
            <a
              href={project.live}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-heading tracking-widest text-platinum-white/40 hover:text-radiant-gold transition-colors flex items-center gap-2"
            >
              LEARN MORE
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects?published=true')
      if (response.ok) {
        const data = await response.json()
        setProjects(data || [])
      } else {
        setProjects([])
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="projects" className="py-32 px-6 sm:px-10 lg:px-12 bg-imperial-navy relative overflow-hidden">
      {/* Subtle Aurora */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-radiant-gold/5 blur-[120px] rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
            <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
              Portfolio
            </span>
          </div>
          <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
            <span className="italic text-radiant-gold">Projects</span>
          </h2>
          <p className="font-body text-platinum-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
            A curated selection of strategic initiatives and digital products built for the modern era.
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[450px] bg-silicon-slate/20 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {projects.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
