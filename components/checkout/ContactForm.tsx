'use client'

import { useState } from 'react'
import { Mail, User } from 'lucide-react'

interface ContactFormProps {
  onSubmit: (data: { name: string; email: string }) => void
  initialData?: { name: string; email: string }
}

export default function ContactForm({ onSubmit, initialData }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
  })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})

  const validate = () => {
    const newErrors: { name?: string; email?: string } = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Full Name *
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/80" size={20} />
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full pl-10 pr-4 py-2 input-brand ${
              errors.name ? 'border-red-500' : ''
            }`}
            placeholder="John Doe"
          />
        </div>
        {errors.name && (
          <p className="mt-1 text-sm text-red-400">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">
          Email Address *
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-platinum-white/80" size={20} />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={`w-full pl-10 pr-4 py-2 input-brand ${
            errors.email ? 'border-red-500' : ''
          }`}
            placeholder="john@example.com"
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-400">{errors.email}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full px-6 py-3 btn-gold text-imperial-navy font-semibold rounded-lg transition-colors"
      >
        Continue to Checkout
      </button>
    </form>
  )
}
