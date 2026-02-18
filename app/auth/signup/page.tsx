'use client'

import { Suspense } from 'react'
import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-gray-400 text-center py-8">Loading...</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  )
}
