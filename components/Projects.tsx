'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Github, Code2 } from 'lucide-react'
import { useState } from 'react'
import { analytics } from '@/lib/analytics'

// Featured projects from portfolio
const projects = [
  {
    id: 1,
    title: 'Error Handling Platform',
    description: 'Reusable platform addressing 10% of raised defects across suite. Simplified complex client configurations with new data flow diagrams.',
    tech: ['Product Management', 'Agile', 'Strategic Planning'],
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    github: '#',
    live: '#',
  },
  {
    id: 2,
    title: 'Proactive Notification Platform',
    description: 'Event-driven notification platform to digitize the awareness stage of customer journey. Partnered with Salesforce Marketing Cloud.',
    tech: ['Product Ownership', 'Customer Insights', 'Agile'],
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    github: '#',
    live: '#',
  },
  {
    id: 3,
    title: 'Workplace 401k Integration',
    description: 'Integrated digital platform for workplace and retail plans, creating $102M in inflows. Managed offshore team to deliver seamless experience.',
    tech: ['Product Management', 'Team Leadership', 'Agile'],
    image: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=800',
    github: '#',
    live: '#',
  },
  {
    id: 4,
    title: 'Customer Insights Framework',
    description: 'Synthesized voice of the client inputs and developed client segmentation frameworks to inform adoption and delivery strategies.',
    tech: ['Market Research', 'Data Analysis', 'Strategy'],
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    github: '#',
    live: '#',
  },
  {
    id: 5,
    title: 'Squad Lead Training Program',
    description: 'Designed and executed a squad lead cohort training program, empowering 15 squad leaders with professional development and best practices.',
    tech: ['People Management', 'Training', 'Leadership'],
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800',
    github: '#',
    live: '#',
  },
  {
    id: 6,
    title: 'Digital Onboarding Platform',
    description: 'Streamlined client onboarding via simplified data flows. Reduced acceptance test window from 3 days to 1 hour, improving time to market by 30%.',
    tech: ['Process Improvement', 'Agile', 'Product Management'],
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800',
    github: '#',
    live: '#',
  },
]

export default function Projects() {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

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
              className="group relative bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm rounded-xl overflow-hidden border transition-all duration-300"
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
              <div className="relative h-48 overflow-hidden rounded-t-xl">
                <motion.img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-contain"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
              </div>

              {/* Project Content */}
              <div className="p-6 relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">
                    {project.title}
                  </h3>
                  <Code2 className="text-purple-400" size={20} />
                </div>

                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {project.description}
                </p>

                {/* Tech Stack */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tech.map((tech) => (
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

                {/* Links */}
                <div className="flex gap-4">
                  <motion.a
                    href={project.github}
                    onClick={(e) => {
                      if (project.github !== '#') {
                        analytics.projectClick(project.id, project.title, 'github')
                      } else {
                        e.preventDefault()
                      }
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Code2 size={18} />
                    <span className="text-sm">Details</span>
                  </motion.a>
                  <motion.a
                    href={project.live}
                    onClick={(e) => {
                      if (project.live !== '#') {
                        analytics.projectClick(project.id, project.title, 'live')
                      } else {
                        e.preventDefault()
                      }
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    whileHover={{ x: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <ExternalLink size={18} />
                    <span className="text-sm">Learn More</span>
                  </motion.a>
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
      </div>
    </section>
  )
}

