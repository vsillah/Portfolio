'use client'

import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <SignupForm />
      </div>
    </div>
  )
}
