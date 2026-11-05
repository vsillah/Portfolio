import Navigation from '@/components/Navigation'
import Contact from '@/components/Contact'

export default function MemberQuotePage() {
  return <main className="min-h-screen bg-background pt-16">
    <Navigation />
    <Contact quoteMode />
  </main>
}
