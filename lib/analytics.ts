// Analytics tracking utility
// Privacy-friendly: No personal data, anonymized IPs

type EventType = 
  | 'page_view' 
  | 'section_view' 
  | 'click' 
  | 'form_submit' 
  | 'video_play'
  | 'scroll'
  | 'time_on_page'

type Section = 
  | 'hero' 
  | 'projects' 
  | 'publications' 
  | 'music' 
  | 'videos' 
  | 'about' 
  | 'contact'
  | 'navigation'

interface AnalyticsEvent {
  event_type: EventType
  event_name: string
  section?: Section
  metadata?: Record<string, any>
}

// Generate or retrieve session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  
  let sessionId = sessionStorage.getItem('analytics_session_id')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('analytics_session_id', sessionId)
  }
  return sessionId
}

// Generate or retrieve user ID (anonymous)
function getUserId(): string {
  if (typeof window === 'undefined') return ''
  
  let userId = localStorage.getItem('analytics_user_id')
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('analytics_user_id', userId)
  }
  return userId
}

// Get device info
function getDeviceInfo() {
  if (typeof window === 'undefined') return {}
  
  const ua = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const isTablet = /iPad|Android/i.test(ua) && !isMobile
  
  return {
    user_agent: ua,
    device_type: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    browser: getBrowser(ua),
    os: getOS(ua),
  }
}

function getBrowser(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Other'
}

function getOS(ua: string): string {
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS')) return 'iOS'
  return 'Other'
}

// Track event
export async function trackEvent(event: AnalyticsEvent) {
  if (typeof window === 'undefined') return

  try {
    const sessionId = getSessionId()
    const userId = getUserId()
    const deviceInfo = getDeviceInfo()

    await fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...event,
        session_id: sessionId,
        user_id: userId,
        ...deviceInfo,
        referrer: document.referrer || null,
        url: window.location.href,
      }),
    })
  } catch (error) {
    // Fail silently - don't break user experience
    console.error('Analytics tracking failed:', error)
  }
}

// Convenience functions
export const analytics = {
  // Page view
  pageView: () => trackEvent({
    event_type: 'page_view',
    event_name: 'page_view',
  }),

  // Section view (when user scrolls to a section)
  sectionView: (section: Section) => trackEvent({
    event_type: 'section_view',
    event_name: `section_view_${section}`,
    section,
  }),

  // Project click
  projectClick: (projectId: number, projectTitle: string, linkType: 'github' | 'live') => trackEvent({
    event_type: 'click',
    event_name: 'project_click',
    section: 'projects',
    metadata: { projectId, projectTitle, linkType },
  }),

  // Video play
  videoPlay: (videoId: string, videoTitle: string) => trackEvent({
    event_type: 'video_play',
    event_name: 'video_play',
    section: 'videos',
    metadata: { videoId, videoTitle },
  }),

  // Social link click
  socialClick: (platform: string, url: string) => trackEvent({
    event_type: 'click',
    event_name: 'social_click',
    section: 'contact',
    metadata: { platform, url },
  }),

  // Contact form view
  contactFormView: () => trackEvent({
    event_type: 'section_view',
    event_name: 'contact_form_view',
    section: 'contact',
  }),

  // Contact form submit (called after successful submission)
  contactFormSubmit: () => trackEvent({
    event_type: 'form_submit',
    event_name: 'contact_form_submit',
    section: 'contact',
  }),

  // Navigation click
  navClick: (destination: string) => trackEvent({
    event_type: 'click',
    event_name: 'navigation_click',
    section: 'navigation',
    metadata: { destination },
  }),
}