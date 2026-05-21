'use client'

import { Suspense } from 'react'
import AuthShell from '@/components/auth/AuthShell'
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
