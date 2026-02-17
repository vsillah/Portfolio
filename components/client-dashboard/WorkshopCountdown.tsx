'use client'

import { useEffect, useState } from 'react'
import { Calendar, Clock } from 'lucide-react'

interface WorkshopCountdownProps {
  meetingDate: string
  meetingType: string
}

export default function WorkshopCountdown({ meetingDate, meetingType }: WorkshopCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(meetingDate))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(meetingDate))
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [meetingDate])

  if (timeLeft.isPast) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-800/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider">
          Next {meetingType || 'Workshop'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <span className="text-2xl font-bold text-white">{timeLeft.days}</span>
          <p className="text-[10px] text-indigo-400 uppercase">Days</p>
        </div>
        <span className="text-indigo-600">:</span>
        <div className="text-center">
          <span className="text-2xl font-bold text-white">{timeLeft.hours}</span>
          <p className="text-[10px] text-indigo-400 uppercase">Hours</p>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 mt-2">
        {new Date(meetingDate).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
      {timeLeft.days <= 1 && (
        <div className="mt-2 flex items-center gap-1 text-yellow-400">
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium">Coming up soon!</span>
        </div>
      )}
    </div>
  )
}

function calculateTimeLeft(dateStr: string) {
  const target = new Date(dateStr).getTime()
  const now = Date.now()
  const diff = target - now

  if (diff <= 0) {
    return { days: 0, hours: 0, isPast: true }
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    isPast: false,
  }
}
