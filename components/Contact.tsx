'use client'

import { motion } from 'framer-motion'
import { Mail, Github, Linkedin, Twitter, Send, Music } from 'lucide-react'
import { useState } from 'react'

const socialLinks = [
  { icon: Linkedin, href: 'https://www.linkedin.com/in/vambah-sillah-08989b8/', label: 'LinkedIn' },
  { icon: Mail, href: 'mailto:vsillah@gmail.com', label: 'Email' },
  { icon: Music, href: 'https://open.spotify.com/artist/1B5vy5knIGXOxClIzkkVHR?si=frSOxcxXSPCi6S04691zkg', label: 'Spotify' },
  { icon: Github, href: 'https://github.com/vsillah', label: 'GitHub' },
]

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    // Add your form submission logic here
    setTimeout(() => {
      setIsSubmitting(false)
      setFormData({ name: '', email: '', message: '' })
      alert('Message sent! (This is a demo - connect to your backend)')
    }, 1000)
  }

  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Get In Touch</span>
          </h2>
          <p className="text-gray-400 text-lg">
            Let's collaborate on your next project or just say hello!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <div>
              <label htmlFor="name" className="block text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-gray-300 mb-2">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={6}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                placeholder="Your message..."
              />
            </div>

            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSubmitting ? (
                'Sending...'
              ) : (
                <>
                  Send Message
                  <Send size={20} />
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Social Links */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Connect With Me</h3>
              <p className="text-gray-400 mb-6">
                Feel free to reach out through any of these platforms. I'm always open to
                discussing new projects, creative ideas, or opportunities.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center justify-center p-6 bg-gray-900 rounded-lg border border-gray-800 hover:border-purple-500/50 transition-all group"
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <social.icon
                    className="text-gray-400 group-hover:text-purple-400 mb-2 transition-colors"
                    size={32}
                  />
                  <span className="text-gray-300 group-hover:text-white transition-colors">
                    {social.label}
                  </span>
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-20 text-center text-gray-500 text-sm"
      >
        <p>© {new Date().getFullYear()} Vambah Sillah. Built with Next.js & Framer Motion</p>
        <p className="mt-2 text-xs text-gray-600">22 Vassar Street, Medford, MA 02155 | 617-967-7448</p>
      </motion.div>
    </section>
  )
}

