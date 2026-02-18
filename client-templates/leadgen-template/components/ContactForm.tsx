'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ContactFormProps {
  /** Custom interest options */
  interestOptions?: Array<{ value: string; label: string }>
  /** Show revenue field */
  showRevenue?: boolean
  /** Show decision maker field */
  showDecisionMaker?: boolean
  /** Custom submit button text */
  submitText?: string
  /** Success message */
  successMessage?: string
  /** On success callback */
  onSuccess?: (id: string) => void
}

export function ContactForm({
  interestOptions = [
    { value: 'consulting', label: 'Consulting Services' },
    { value: 'technology', label: 'Technology Solutions' },
    { value: 'partnership', label: 'Partnership Opportunity' },
    { value: 'other', label: 'Other' },
  ],
  showRevenue = false,
  showDecisionMaker = false,
  submitText = 'Send Message',
  successMessage = "Thank you! We'll be in touch soon.",
  onSuccess,
}: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    companyDomain: '',
    linkedinUrl: '',
    annualRevenue: '',
    interestAreas: [] as string[],
    isDecisionMaker: false,
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      setIsSuccess(true)
      onSuccess?.(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInterestChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      interestAreas: prev.interestAreas.includes(value)
        ? prev.interestAreas.filter(v => v !== value)
        : [...prev.interestAreas, value],
    }))
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-xl border border-green-200"
      >
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <p className="text-green-800 text-center font-medium">{successMessage}</p>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name & Email */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            id="name"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Company & Domain */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
            Company
          </label>
          <input
            type="text"
            id="company"
            value={formData.company}
            onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="companyDomain" className="block text-sm font-medium text-gray-700 mb-1">
            Website
          </label>
          <input
            type="text"
            id="companyDomain"
            placeholder="example.com"
            value={formData.companyDomain}
            onChange={(e) => setFormData(prev => ({ ...prev, companyDomain: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* LinkedIn URL */}
      <div>
        <label htmlFor="linkedinUrl" className="block text-sm font-medium text-gray-700 mb-1">
          LinkedIn Profile
        </label>
        <input
          type="text"
          id="linkedinUrl"
          placeholder="linkedin.com/in/yourprofile"
          value={formData.linkedinUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Revenue (optional) */}
      {showRevenue && (
        <div>
          <label htmlFor="annualRevenue" className="block text-sm font-medium text-gray-700 mb-1">
            Annual Revenue
          </label>
          <select
            id="annualRevenue"
            value={formData.annualRevenue}
            onChange={(e) => setFormData(prev => ({ ...prev, annualRevenue: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select range</option>
            <option value="under_100k">Under $100K</option>
            <option value="100k_500k">$100K - $500K</option>
            <option value="500k_1m">$500K - $1M</option>
            <option value="1m_5m">$1M - $5M</option>
            <option value="5m_plus">$5M+</option>
          </select>
        </div>
      )}

      {/* Interest Areas */}
      {interestOptions.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What are you interested in?
          </label>
          <div className="space-y-2">
            {interestOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.interestAreas.includes(option.value)}
                  onChange={() => handleInterestChange(option.value)}
                  className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Decision Maker (optional) */}
      {showDecisionMaker && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isDecisionMaker}
            onChange={(e) => setFormData(prev => ({ ...prev, isDecisionMaker: e.target.checked }))}
            className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-gray-700">I am a decision maker for this project</span>
        </label>
      )}

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message *
        </label>
        <textarea
          id="message"
          required
          rows={4}
          value={formData.message}
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Submit */}
      <motion.button
        type="submit"
        disabled={isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send size={18} />
            {submitText}
          </>
        )}
      </motion.button>
    </form>
  )
}
