export default function RootLoading() {
  return (
    <div className="min-h-screen bg-imperial-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-radiant-gold/30 border-t-radiant-gold rounded-full animate-spin" />
        <p className="text-platinum-white/50 text-sm font-heading tracking-widest uppercase">
          Loading
        </p>
      </div>
    </div>
  )
}
