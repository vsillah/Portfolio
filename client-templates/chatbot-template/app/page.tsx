import { Chat } from '@/components/chat/Chat'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-8">Chatbot Template</h1>
      <div className="w-full max-w-2xl">
        <Chat />
      </div>
    </main>
  )
}
