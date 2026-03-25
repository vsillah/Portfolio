export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="h-5 w-40 bg-silicon-slate/40 rounded animate-pulse mb-6" />
        <div className="h-8 w-56 bg-silicon-slate/40 rounded animate-pulse mb-2" />
        <div className="h-4 w-80 bg-silicon-slate/30 rounded animate-pulse mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-silicon-slate bg-silicon-slate/30 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-silicon-slate/50 animate-pulse" />
                <div className="h-5 w-32 bg-silicon-slate/40 rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-silicon-slate/30 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-silicon-slate/30 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-silicon-slate/30 rounded animate-pulse" />
              </div>
              <div className="h-24 bg-silicon-slate/20 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
