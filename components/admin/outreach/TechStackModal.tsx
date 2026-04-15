'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, X } from 'lucide-react'

export interface TechStackResult {
  domain: string
  technologies?: Array<{ name: string; tag?: string; categories?: string[] }>
  byTag?: Record<string, string[]>
  error?: string
  creditsRemaining?: number
}

interface TechStackModalProps {
  result: TechStackResult | null
  onClose: () => void
}

export default function TechStackModal({ result, onClose }: TechStackModalProps) {
  return (
    <AnimatePresence>
      {result != null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col bg-background border border-silicon-slate rounded-xl shadow-xl"
          >
            <div className="p-4 border-b border-silicon-slate flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Cpu size={20} />
                Tech stack — {result.domain}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg bg-silicon-slate/50 hover:bg-silicon-slate text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {result.error ? (
                <p className="text-sm text-amber-400">{result.error}</p>
              ) : (
                <>
                  {result.technologies && result.technologies.length > 0 ? (
                    <>
                      {result.byTag && Object.keys(result.byTag).length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">By category</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(result.byTag).map(([tag, names]) => (
                              <div key={tag} className="rounded-lg bg-silicon-slate/50 border border-silicon-slate p-2 min-w-[140px]">
                                <div className="text-xs text-muted-foreground mb-1">{tag}</div>
                                <ul className="text-sm text-foreground space-y-0.5">
                                  {names.slice(0, 8).map((n) => (
                                    <li key={n}>{n}</li>
                                  ))}
                                  {names.length > 8 && <li className="text-muted-foreground">+{names.length - 8} more</li>}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                          All technologies ({result.technologies.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                          {result.technologies.map((t) => (
                            <span
                              key={t.name}
                              className="px-2 py-1 rounded bg-silicon-slate/50 border border-silicon-slate text-sm text-foreground"
                            >
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No technologies detected for this domain.</p>
                  )}
                </>
              )}
              {result.creditsRemaining != null && (
                <p className="text-xs text-muted-foreground/90">API credits remaining: {result.creditsRemaining}</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
