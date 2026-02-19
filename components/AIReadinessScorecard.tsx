'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  SCORECARD_QUESTIONS,
  rawScoreToTen,
  getResultCopy,
  getRecommendations,
  type ScorecardQuestion,
  type ScorecardResource,
} from '@/lib/scorecard'

type Step = 'intro' | 'questions' | 'scored' | 'email_gate' | 'submitting' | 'unlocked' | 'error'

/** Optional list of templates/playbooks to recommend from (e.g. from Resources page) */
interface AIReadinessScorecardProps {
  leadMagnets?: Array<{ id: number; title: string; description: string | null; slug?: string | null }>
}

export default function AIReadinessScorecard({ leadMagnets = [] }: AIReadinessScorecardProps) {
  const [step, setStep] = useState<Step>('intro')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [rawScore, setRawScore] = useState(0)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [submitError, setSubmitError] = useState('')

  const currentQuestion = SCORECARD_QUESTIONS[currentQuestionIndex] as ScorecardQuestion | undefined
  const totalQuestions = SCORECARD_QUESTIONS.length
  const progress = totalQuestions > 0 ? (currentQuestionIndex / totalQuestions) * 100 : 0

  const handleAnswer = useCallback(
    (questionId: string, points: number) => {
      setAnswers((prev) => ({ ...prev, [questionId]: points }))
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex((i) => i + 1)
      } else {
        const prevSum = Object.values(answers).reduce((a, b) => a + b, 0)
        setRawScore(prevSum + points)
        setStep('scored')
      }
    },
    [currentQuestionIndex, totalQuestions, answers]
  )

  const handleBack = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1)
    }
  }, [currentQuestionIndex])

  const handleStart = useCallback(() => {
    setCurrentQuestionIndex(0)
    setAnswers({})
    setStep('questions')
  }, [])

  const handleEmailSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setSubmitError('')
      if (!email.trim()) {
        setSubmitError('Please enter your email.')
        return
      }
      setStep('submitting')
      try {
        const scoreOutOf10 = rawScoreToTen(rawScore)
        const res = await fetch('/api/scorecard/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim() || undefined,
            score: rawScore,
            answers: answers,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStep('email_gate')
          setSubmitError(data?.error || 'Something went wrong. Please try again.')
          return
        }
        setStep('unlocked')
      } catch {
        setStep('email_gate')
        setSubmitError('Something went wrong. Please try again.')
      }
    },
    [email, name, rawScore, answers]
  )

  const scoreOutOf10 = rawScoreToTen(rawScore)
  const resultCopy = getResultCopy(scoreOutOf10)

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 p-6 rounded-xl border border-radiant-gold/30 bg-radiant-gold/5"
      aria-labelledby="scorecard-heading"
      aria-live="polite"
    >
      <h2 id="scorecard-heading" className="text-2xl font-bold text-radiant-gold mb-2">
        AI Readiness Scorecard
      </h2>

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <p className="text-platinum-white/80">
              Answer a few questions to get your AI Readiness score and personalized recommendations.
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy transition"
              aria-label="Start assessment"
            >
              Start assessment
            </button>
          </motion.div>
        )}

        {step === 'questions' && currentQuestion && (
          <motion.div
            key={`q-${currentQuestion.id}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <p className="text-platinum-white/60 text-sm" aria-live="polite">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
            <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 rounded-full bg-black/30 overflow-hidden">
              <motion.div
                className="h-full bg-radiant-gold"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <h3 className="text-lg font-semibold text-platinum-white">{currentQuestion.question}</h3>
            <ul className="space-y-2" role="list">
              {currentQuestion.options.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => handleAnswer(currentQuestion.id, opt.points)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-radiant-gold/40 bg-black/20 text-platinum-white hover:bg-radiant-gold/10 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-transparent transition min-h-[44px]"
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
            {currentQuestionIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="text-platinum-white/70 hover:text-platinum-white text-sm focus:outline-none focus:underline"
              >
                Back
              </button>
            )}
          </motion.div>
        )}

        {step === 'scored' && (
          <motion.div
            key="scored"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <p className="text-platinum-white/80">Your AI Readiness score</p>
            <p className="text-3xl font-bold text-radiant-gold" aria-live="polite">
              {scoreOutOf10}/10
            </p>
            <p className="text-platinum-white/70 text-sm">{resultCopy.summary}</p>
            <button
              type="button"
              onClick={() => setStep('email_gate')}
              className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy transition"
            >
              Get my full results
            </button>
          </motion.div>
        )}

        {step === 'email_gate' && (
          <motion.form
            key="email_gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleEmailSubmit}
            className="space-y-4"
          >
            <p className="text-platinum-white/80">Enter your email to unlock your full recommendations.</p>
            {submitError && (
              <p className="text-red-400 text-sm" role="alert">
                {submitError}
              </p>
            )}
            <div>
              <label htmlFor="scorecard-name" className="block text-sm text-platinum-white/80 mb-1">
                Name (optional)
              </label>
              <input
                id="scorecard-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="scorecard-email" className="block text-sm text-platinum-white/80 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="scorecard-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-radiant-gold/40 text-platinum-white placeholder:text-platinum-white/50 focus:border-radiant-gold focus:ring-2 focus:ring-radiant-gold/30 focus:outline-none"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-radiant-gold text-imperial-navy font-semibold hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-imperial-navy transition"
            >
              Unlock my results
            </button>
          </motion.form>
        )}

        {step === 'submitting' && (
          <motion.div
            key="submitting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-platinum-white/80"
          >
            Saving your results…
          </motion.div>
        )}

        {step === 'unlocked' && (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Personalized score card */}
            <div className="rounded-lg border border-radiant-gold/40 bg-radiant-gold/10 p-4">
              <p className="text-platinum-white/80 text-sm mb-1">
                {name.trim()
                  ? `${name.trim()}, here’s your AI Readiness Score`
                  : 'Your AI Readiness Score'}
              </p>
              <p className="text-3xl font-bold text-radiant-gold" aria-live="polite">
                {scoreOutOf10}/10
              </p>
            </div>
            <p className="text-platinum-white/80">
              {name.trim()
                ? `We’ve saved your results, ${name.trim()}. Here’s your full breakdown.`
                : 'We’ve saved your results. Here’s your full breakdown.'}
            </p>
            <h3 className="text-lg font-semibold text-radiant-gold">{resultCopy.title}</h3>
            <p className="text-platinum-white/80">{resultCopy.summary}</p>
            <ul className="list-disc list-inside space-y-2 text-platinum-white/80">
              {resultCopy.bullets.map((bullet, i) => (
                <li key={i}>{bullet}</li>
              ))}
            </ul>
            {(() => {
              const resources: ScorecardResource[] = leadMagnets.map((m) => ({
                id: m.id,
                title: m.title,
                description: m.description,
                slug: m.slug ?? null,
              }))
              const recommendations = getRecommendations(answers, resources)
              if (recommendations.length === 0) {
                return (
                  <p className="text-platinum-white/60 text-sm">
                    Check the templates and playbooks below for next steps.
                  </p>
                )
              }
              return (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-radiant-gold">Recommended for you</h3>
                  <p className="text-platinum-white/80 text-sm">
                    Based on your answers, these templates and playbooks can help you most.
                  </p>
                  <ul className="space-y-4" role="list">
                    {recommendations.map((rec) => (
                      <li
                        key={rec.resource.id}
                        className="rounded-lg border border-radiant-gold/30 bg-black/20 p-4 space-y-2"
                      >
                        <p className="font-semibold text-platinum-white">{rec.resource.title}</p>
                        <p className="text-platinum-white/90 text-sm">{rec.outcome}</p>
                        <div className="text-platinum-white/70 text-sm">
                          <span className="font-medium">Based on your answers:</span>
                          <ul className="mt-1 list-disc list-inside space-y-0.5">
                            {rec.triggeredBy.map((t, i) => (
                              <li key={i}>
                                &ldquo;{t.questionText}&rdquo; → {t.selectedLabel}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <a
                          href="#templates-heading"
                          className="inline-block mt-2 text-sm font-medium text-radiant-gold hover:underline focus:outline-none focus:ring-2 focus:ring-radiant-gold focus:ring-offset-2 focus:ring-offset-transparent"
                        >
                          View in templates & playbooks →
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })()}
          </motion.div>
        )}

        {step === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-red-400"
            role="alert"
          >
            <p>Something went wrong. Please try again or use the contact form.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
