'use client'

import { motion } from 'framer-motion'
import { Code, Users, Target, BarChart3, Lightbulb, Award } from 'lucide-react'

const skills = [
  { icon: Target, name: 'Strategic Planning', level: 95, color: 'from-blue-500 to-cyan-500' },
  { icon: Users, name: 'People Management', level: 90, color: 'from-green-500 to-emerald-500' },
  { icon: BarChart3, name: 'Data Analysis', level: 88, color: 'from-purple-500 to-pink-500' },
  { icon: Lightbulb, name: 'Product Innovation', level: 92, color: 'from-orange-500 to-red-500' },
  { icon: Code, name: 'Technical Skills', level: 85, color: 'from-yellow-500 to-orange-500' },
  { icon: Award, name: 'Agile Methodology', level: 95, color: 'from-indigo-500 to-purple-500' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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
    },
  },
}

export default function About() {
  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">About Me</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            IT Product Manager with expertise in agile methodology, strategic planning, and customer-focused innovation
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Profile Image & Description */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-6"
          >
            {/* Profile Image */}
            <motion.div
              variants={itemVariants}
              className="flex justify-center lg:justify-start mb-6"
            >
              <motion.div
                className="relative w-48 h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden border-2 border-purple-500/30 shadow-xl"
                whileHover={{ scale: 1.02 }}
                style={{
                  boxShadow: '0 0 25px rgba(139, 92, 246, 0.3)',
                }}
              >
                <img
                  src="/V Profile Autumn_Replicate.jpg"
                  alt="Vambah Sillah"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                e.currentTarget.src = '/V Profile_Replicate.jpg'
              }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10" />
              </motion.div>
            </motion.div>
            <motion.p
              variants={itemVariants}
              className="text-gray-300 text-lg leading-relaxed"
            >
              I'm an IT Product Manager with a proven track record of applying agile methodology to continuously evolve products to delight customers. Skilled facilitator with a passion for inspiring teams to deliver innovative solutions.
            </motion.p>
            <motion.p
              variants={itemVariants}
              className="text-gray-300 text-lg leading-relaxed"
            >
              I have excellent analytical skills with demonstrated ability to transform qualitative and quantitative data into actionable insights. My entrepreneurial mindset drives a bias for customer-focused innovation.
            </motion.p>
            <motion.p
              variants={itemVariants}
              className="text-gray-300 text-lg leading-relaxed"
            >
              With managerial experience designing professional development programs, I've demonstrated ability to identify market opportunities, plan strategic initiatives, and execute towards established objectives.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="pt-4 border-t border-gray-800"
            >
              <p className="text-gray-400 text-sm">
                <strong className="text-gray-300">Education:</strong> BS Business Administration, Boston University (2008)
              </p>
              <p className="text-gray-400 text-sm mt-2">
                <strong className="text-gray-300">Certifications:</strong> Certified Scrum Master, Certified Product Owner (2014)
              </p>
              <p className="text-gray-400 text-sm mt-2">
                <strong className="text-gray-300">Interests:</strong> Spanish (conversational), chess, mountain biking, obstacle course racing
              </p>
              <p className="text-gray-400 text-sm mt-2">
                <strong className="text-gray-300">Creative Work:</strong> Hip hop artist (Mad Hadda) - Released album "Into the Rabbit Hole" (2025)
              </p>
            </motion.div>
          </motion.div>

          {/* Right Column - Skills */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-6"
          >
            {skills.map((skill, index) => (
              <motion.div
                key={skill.name}
                variants={itemVariants}
                className="group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${skill.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
                      <skill.icon className="text-white" size={20} />
                    </div>
                    <span className="text-white font-semibold">{skill.name}</span>
                  </div>
                  <span className="text-gray-400 text-sm">{skill.level}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${skill.color} rounded-full`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${skill.level}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: index * 0.1 }}
                  />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

