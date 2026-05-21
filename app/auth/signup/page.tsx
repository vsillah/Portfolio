'use client'

import { Suspense } from 'react'
import AuthShell from '@/components/auth/AuthShell'
import SignupForm from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  )
}
