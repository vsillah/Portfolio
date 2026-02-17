'use client'

import { Calendar, ListTodo, Clock } from 'lucide-react'
import WorkshopCountdown from './WorkshopCountdown'

interface QuickOverviewProps {
  assessmentDate: string | null
  activeTasks: number
  nextMeeting: { meeting_date: string; meeting_type: string } | null
}

export default function QuickOverview({
  assessmentDate,
  activeTasks,
  nextMeeting,
}: QuickOverviewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Quick Overview
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Assessment Date</p>
              <p className="text-sm text-gray-300">
                {assessmentDate
                  ? new Date(assessmentDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Not completed'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ListTodo className="w-4 h-4 text-gray-500" />
            <div>
              <p className="text-[10px] text-gray-500 uppercase">Active Tasks</p>
              <p className="text-sm text-gray-300">{activeTasks}</p>
            </div>
          </div>
          {nextMeeting && (
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Next Workshop</p>
                <p className="text-sm text-gray-300">
                  {new Date(nextMeeting.meeting_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {nextMeeting && (
        <WorkshopCountdown
          meetingDate={nextMeeting.meeting_date}
          meetingType={nextMeeting.meeting_type}
        />
      )}
    </div>
  )
}
