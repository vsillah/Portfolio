export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Diagnostic Template</h1>
      <p className="text-lg text-gray-600 max-w-xl text-center mb-8">
        Diagnostic assessment tool with Supabase storage and n8n completion webhook.
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 max-w-lg w-full">
        <h2 className="font-semibold mb-2">Getting started</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Run the database schema in <code className="bg-gray-100 px-1 rounded">database/schema.sql</code></li>
          <li>Set environment variables per <code className="bg-gray-100 px-1 rounded">.env.example</code></li>
          <li>Add your diagnostic questions and UI components</li>
          <li>Configure the n8n completion webhook</li>
        </ol>
      </div>
    </main>
  )
}
