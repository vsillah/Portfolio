'use client'

import { Suspense } from 'react'
import LoginForm from '@/components/auth/LoginForm'
import SiteThemeCorner from '@/components/SiteThemeCorner'

export default function LoginPage() {
  return (
    <>
      <SiteThemeCorner />
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="text-muted-foreground text-center py-8">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
    </>
  )
}
