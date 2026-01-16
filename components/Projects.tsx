'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Github, Code2, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
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

export default function Projects() {
  const [hoveredId, setHoveredId] = useState<number | null>(null)
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
        // If API fails (e.g., table doesn't exist yet), use empty array
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
    <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8 bg-black relative overflow-hidden">
      {/* Subtle background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl" />
      </div>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Featured Projects</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A showcase of strategic initiatives, platforms, and digital experiences managed from concept to execution
          </p>
        </motion.div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400">No projects available at the moment.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onHoverStart={() => setHoveredId(project.id)}
              onHoverEnd={() => setHoveredId(null)}
              className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border transition-all duration-300 flex flex-col"
              style={{
                borderColor: hoveredId === project.id 
                  ? 'rgba(139, 92, 246, 0.6)' 
                  : 'rgba(55, 65, 81, 0.5)',
                boxShadow: hoveredId === project.id
                  ? '0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(236, 72, 153, 0.2)'
                  : 'none',
              }}
            >
              {/* Animated glowing border */}
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  background: hoveredId === project.id
                    ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3))'
                    : 'transparent',
                  opacity: hoveredId === project.id ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                }}
              />
              <div className="absolute inset-[1px] rounded-xl bg-gradient-to-br from-gray-900 to-black" />
              {/* Project Image */}
              <div className="relative h-48 overflow-hidden rounded-t-xl flex-shrink-0">
                <motion.img
                  src={project.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'}
                  alt={project.title}
                  className="w-full h-full object-contain"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              </div>

              {/* Project Content */}
              <div className="p-6 relative z-10 flex flex-col flex-grow">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                    {project.title}
                  </h3>
                  <Code2 className="text-purple-400 flex-shrink-0" size={20} />
                </div>

                {/* Expandable Description */}
                {project.description && (
                  <ExpandableText
                    text={project.description}
                    maxHeight={80}
                    className="text-gray-400 text-sm"
                    expandButtonColor="text-purple-400 hover:text-purple-300"
                  />
                )}

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.technologies && project.technologies.map((tech) => (
                    <motion.span
                      key={tech}
                      className="px-3 py-1 text-xs bg-gray-800/50 text-gray-300 rounded-md border border-gray-700/50 backdrop-blur-sm"
                      whileHover={{ 
                        scale: 1.05,
                        borderColor: 'rgba(139, 92, 246, 0.5)',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                      }}
                    >
                      {tech}
                    </motion.span>
                  ))}
                </div>

                {/* Spacer to push links to bottom */}
                <div className="flex-grow" />

                {/* Links */}
                <div className="flex gap-4 flex-wrap mt-auto">
                  {project.github && (
                    <motion.a
                      href={project.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        analytics.projectClick(project.id, project.title, 'github')
                      }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Code2 size={18} />
                      <span className="text-sm">Details</span>
                    </motion.a>
                  )}
                  {project.live && (
                    <motion.a
                      href={project.live}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        analytics.projectClick(project.id, project.title, 'live')
                      }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ExternalLink size={18} />
                      <span className="text-sm">Learn More</span>
                    </motion.a>
                  )}
                  {project.file_path && (
                    <motion.a
                      href={`/api/projects/${project.id}/download`}
                      onClick={async (e) => {
                        e.preventDefault()
                        try {
                          const response = await fetch(`/api/projects/${project.id}/download`)
                          if (response.ok) {
                            const data = await response.json()
                            window.open(data.downloadUrl, '_blank')
                            analytics.projectClick(project.id, project.title, 'download')
                          }
                        } catch (error) {
                          console.error('Error downloading file:', error)
                        }
                      }}
                      className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                      whileHover={{ x: 5 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Download size={18} />
                      <span className="text-sm">Download</span>
                    </motion.a>
                  )}
                </div>
              </div>

              {/* Animated glow effect */}
              {hoveredId === project.id && (
                <motion.div
                  className="absolute -inset-1 rounded-xl pointer-events-none opacity-75"
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div 
                    className="absolute inset-0 rounded-xl blur-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.4))',
                    }}
                  />
                </motion.div>
              )}
            </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
