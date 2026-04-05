'use client'

import { motion } from 'framer-motion'
import { Check, AlertCircle, Loader2, X } from 'lucide-react'

export interface ProgressStep {
  id: string
  label: string
  detail?: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export interface ProgressPanelProps {
  title: string
  steps: ProgressStep[]
  variant?: 'card' | 'inline'
  error?: string | null
  onCancel?: () => void
}

function StepNode({ step, index }: { step: ProgressStep; index: number }) {
  const size = 'w-7 h-7'
  const base = 'flex items-center justify-center rounded-full text-xs font-bold shrink-0 transition-all duration-300'

  switch (step.status) {
    case 'done':
      return (
        <motion.div
          className={`${base} ${size} bg-emerald-500 text-white`}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </motion.div>
      )
    case 'active':
      return (
        <div className={`${base} ${size} border-2 border-radiant-gold bg-radiant-gold/20 text-radiant-gold relative`}>
          <span>{index + 1}</span>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-radiant-gold/40"
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
      )
    case 'error':
      return (
        <div className={`${base} ${size} bg-red-500/20 border-2 border-red-500 text-red-400`}>
          <AlertCircle className="w-4 h-4" />
        </div>
      )
    default:
      return (
        <div className={`${base} ${size} border-2 border-gray-600 text-gray-500`}>
          <span>{index + 1}</span>
        </div>
      )
  }
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <div className="flex-1 h-0.5 bg-gray-700 rounded-full overflow-hidden min-w-[16px]">
      <motion.div
        className="h-full bg-emerald-500"
        initial={{ width: '0%' }}
        animate={{ width: filled ? '100%' : '0%' }}
        transition={{ duration: 0.4 }}
      />
    </div>
  )
}

export default function ProgressPanel({ title, steps, variant = 'card', error, onCancel }: ProgressPanelProps) {
  const doneCount = steps.filter(s => s.status === 'done').length
  const total = steps.length
  const isFinished = doneCount === total && total > 0
  const hasError = steps.some(s => s.status === 'error')
  const activeStep = steps.find(s => s.status === 'active')
  const errorStep = steps.find(s => s.status === 'error')

  if (variant === 'inline') {
    return (
      <div className="mt-2 mb-1">
        <div className="flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <StepNode step={step} index={i} />
              {i < steps.length - 1 && <Connector filled={steps[i + 1]?.status === 'done' || steps[i + 1]?.status === 'active'} />}
            </div>
          ))}
          {hasError && onCancel && (
            <button onClick={onCancel} className="ml-1 text-gray-400 hover:text-red-400 transition-colors" title="Dismiss">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1" style={{ flex: i < steps.length - 1 ? 1 : undefined }}>
              <span className={`text-[9px] font-medium uppercase tracking-wide whitespace-nowrap ${
                step.status === 'done' ? 'text-emerald-400' : step.status === 'active' ? 'text-radiant-gold' : step.status === 'error' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        {(hasError && (errorStep?.detail || error)) && (
          <div className="mt-1.5 text-[10px] text-red-400">{error || errorStep?.detail}</div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-background/80 border border-silicon-slate rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {onCancel && (!isFinished || hasError) && (
          <button onClick={onCancel} className="text-gray-400 hover:text-red-400 transition-colors" title={hasError ? 'Dismiss' : 'Cancel'}>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal stepper */}
      <div className="flex items-center px-2">
        {steps.map((step, i) => (
          <div key={step.id} className="contents">
            <div className="flex flex-col items-center">
              <StepNode step={step} index={i} />
              <span className={`text-[9px] font-medium uppercase tracking-wide mt-1.5 text-center whitespace-nowrap ${
                step.status === 'done' ? 'text-emerald-400' : step.status === 'active' ? 'text-radiant-gold' : step.status === 'error' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 self-start mt-3.5 mx-1">
                <Connector filled={steps[i + 1]?.status === 'done' || steps[i + 1]?.status === 'active'} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active step detail or error */}
      {(activeStep?.detail || error) && (
        <div className="mt-3 flex items-center gap-2 justify-center">
          {!error && activeStep && <Loader2 className="w-3 h-3 text-radiant-gold animate-spin shrink-0" />}
          <span className={`text-[10px] ${error ? 'text-red-400' : 'text-gray-400'}`}>
            {error || activeStep?.detail}
          </span>
        </div>
      )}

      {isFinished && (
        <div className="mt-3 text-center">
          <span className="text-[10px] text-emerald-400 font-medium">Complete</span>
        </div>
      )}
    </div>
  )
}
