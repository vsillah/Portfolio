import { ContactForm } from '@/components/ContactForm'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">Lead Generation Template</h1>
      <div className="w-full max-w-lg">
        <ContactForm />
      </div>
    </main>
  )
}
