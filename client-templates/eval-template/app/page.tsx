export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Eval Template</h1>
      <p className="text-lg text-gray-600 max-w-xl text-center mb-8">
        Chat evaluation with LLM-as-a-Judge and human annotation.
        Use the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">lib/llm-judge.ts</code> module
        to evaluate chat conversations programmatically.
      </p>
      <div className="bg-gray-50 border rounded-lg p-6 max-w-lg w-full">
        <h2 className="font-semibold mb-2">Getting started</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Run the database schema in <code className="bg-gray-100 px-1 rounded">database/schema.sql</code></li>
          <li>Set your API keys in <code className="bg-gray-100 px-1 rounded">.env.local</code></li>
          <li>Import and call <code className="bg-gray-100 px-1 rounded">evaluateConversation()</code> from <code className="bg-gray-100 px-1 rounded">lib/llm-judge.ts</code></li>
        </ol>
      </div>
    </main>
  )
}
