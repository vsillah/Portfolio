/**
 * Mock Warm Lead Data Generator
 * Generates realistic test warm lead data without calling actual n8n workflows
 */

export interface MockWarmLead {
  name: string
  email?: string
  company?: string
  company_domain?: string
  job_title?: string
  industry?: string
  location?: string
  lead_source: string
  linkedin_url?: string
  linkedin_username?: string
  facebook_profile_url?: string
  phone_number?: string
  relationship_strength: 'strong' | 'moderate' | 'weak'
  warm_source_detail: string
  message?: string
}

// Sample data pools
const FIRST_NAMES = [
  'Sarah', 'Mike', 'Emma', 'David', 'Lisa',
  'James', 'Jennifer', 'Michael', 'Amanda', 'Chris',
  'Jessica', 'Daniel', 'Ashley', 'Matthew', 'Melissa',
  'Ryan', 'Nicole', 'Kevin', 'Rachel', 'Brian'
]

const LAST_NAMES = [
  'Johnson', 'Chen', 'Wilson', 'Park', 'Anderson',
  'Martinez', 'Taylor', 'Garcia', 'Brown', 'Lee',
  'Thompson', 'White', 'Harris', 'Martin', 'Walker',
  'Lewis', 'Robinson', 'Clark', 'Rodriguez', 'Hill'
]

const COMPANIES = [
  'TechCorp', 'InnovateLabs', 'DataFlow Inc', 'CloudScale', 'AIStartup',
  'DigitalHub', 'SmartSolutions', 'FutureTech', 'NexGen Systems', 'VisionAI',
  'Quantum Dynamics', 'Apex Industries', 'Synergy Group', 'Pioneer Co', 'Catalyst Ventures'
]

const COMPANY_DOMAINS = [
  'techcorp.com', 'innovatelabs.io', 'dataflow.com', 'cloudscale.io', 'aistartup.ai',
  'digitalhub.com', 'smartsolutions.co', 'futuretech.io', 'nexgen.systems', 'visionai.com',
  'quantumdynamics.com', 'apex.industries', 'synergygroup.io', 'pioneer.co', 'catalystvc.com'
]

const JOB_TITLES = [
  'Product Manager', 'VP of Engineering', 'CTO', 'Director of Operations',
  'Head of Sales', 'Marketing Director', 'CEO', 'COO', 'Business Development Manager',
  'Growth Lead', 'VP of Product', 'Head of AI', 'Chief Strategy Officer',
  'Engineering Manager', 'Head of Innovation'
]

const INDUSTRIES = [
  'SaaS', 'Technology', 'Fintech', 'E-commerce', 'Healthcare Tech',
  'EdTech', 'Marketing Tech', 'HR Tech', 'Real Estate Tech', 'AI/ML',
  'Consulting', 'Enterprise Software', 'Developer Tools', 'Data Analytics', 'Cloud Services'
]

const LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Boston, MA',
  'Los Angeles, CA', 'Chicago, IL', 'Denver, CO', 'Miami, FL', 'Portland, OR',
  'Atlanta, GA', 'Toronto, Canada', 'London, UK', 'Berlin, Germany', 'Singapore'
]

const FACEBOOK_GROUP_NAMES = [
  'Tech Founders Network',
  'AI & Automation Community',
  'SaaS Entrepreneurs',
  'Digital Marketing Professionals',
  'Startup Founders Hub',
  'Product Management Circle',
  'Tech Leaders Forum'
]

const LINKEDIN_POST_TOPICS = [
  'AI automation insights',
  'SaaS growth strategies',
  'Product launch announcement',
  'Industry trends analysis',
  'Team building tips',
  'Remote work best practices',
  'Tech innovation discussion'
]

/**
 * Generate mock Facebook leads (friends, groups, engagement)
 */
export function generateMockFacebookLeads(count: number): MockWarmLead[] {
  const sources: Array<{ type: string; strength: 'strong' | 'moderate' | 'weak' }> = [
    { type: 'warm_facebook_friends', strength: 'strong' },
    { type: 'warm_facebook_groups', strength: 'moderate' },
    { type: 'warm_facebook_engagement', strength: 'weak' }
  ]

  return Array.from({ length: count }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const name = `${firstName} ${lastName}`
    const company = COMPANIES[i % COMPANIES.length]
    const sourceConfig = sources[i % sources.length]

    let sourceDetail = ''
    if (sourceConfig.type === 'warm_facebook_friends') {
      sourceDetail = 'Direct Facebook friend'
    } else if (sourceConfig.type === 'warm_facebook_groups') {
      sourceDetail = FACEBOOK_GROUP_NAMES[i % FACEBOOK_GROUP_NAMES.length]
    } else {
      sourceDetail = `Liked post about ${LINKEDIN_POST_TOPICS[i % LINKEDIN_POST_TOPICS.length]}`
    }

    return {
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${COMPANY_DOMAINS[i % COMPANY_DOMAINS.length]}`,
      company,
      company_domain: COMPANY_DOMAINS[i % COMPANY_DOMAINS.length],
      job_title: JOB_TITLES[i % JOB_TITLES.length],
      industry: INDUSTRIES[i % INDUSTRIES.length],
      location: LOCATIONS[i % LOCATIONS.length],
      lead_source: sourceConfig.type,
      facebook_profile_url: `https://facebook.com/test-${firstName.toLowerCase()}-${i}`,
      relationship_strength: sourceConfig.strength,
      warm_source_detail: sourceDetail,
      message: `Met through Facebook - ${sourceDetail}`
    }
  })
}

/**
 * Generate mock Google Contacts leads
 */
export function generateMockGoogleContactsLeads(count: number): MockWarmLead[] {
  return Array.from({ length: count }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const name = `${firstName} ${lastName}`
    const company = COMPANIES[i % COMPANIES.length]

    return {
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${COMPANY_DOMAINS[i % COMPANY_DOMAINS.length]}`,
      company,
      company_domain: COMPANY_DOMAINS[i % COMPANY_DOMAINS.length],
      job_title: JOB_TITLES[i % JOB_TITLES.length],
      industry: INDUSTRIES[i % INDUSTRIES.length],
      location: LOCATIONS[i % LOCATIONS.length],
      phone_number: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      lead_source: 'warm_google_contacts',
      relationship_strength: 'strong',
      warm_source_detail: 'Saved in Google Contacts with business info',
      message: 'Synced from Google Contacts'
    }
  })
}

/**
 * Generate mock LinkedIn leads (connections, engagement)
 */
export function generateMockLinkedInLeads(count: number): MockWarmLead[] {
  const sources: Array<{ type: string; strength: 'strong' | 'moderate' | 'weak' }> = [
    { type: 'warm_linkedin_connections', strength: 'strong' },
    { type: 'warm_linkedin_engagement', strength: 'weak' }
  ]

  return Array.from({ length: count }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
    const name = `${firstName} ${lastName}`
    const company = COMPANIES[i % COMPANIES.length]
    const sourceConfig = sources[i % sources.length]
    const username = `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.floor(Math.random() * 1000)}`

    const sourceDetail = sourceConfig.type === 'warm_linkedin_connections'
      ? '1st-degree connection'
      : `Engaged with post about ${LINKEDIN_POST_TOPICS[i % LINKEDIN_POST_TOPICS.length]}`

    return {
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${COMPANY_DOMAINS[i % COMPANY_DOMAINS.length]}`,
      company,
      company_domain: COMPANY_DOMAINS[i % COMPANY_DOMAINS.length],
      job_title: JOB_TITLES[i % JOB_TITLES.length],
      industry: INDUSTRIES[i % INDUSTRIES.length],
      location: LOCATIONS[i % LOCATIONS.length],
      lead_source: sourceConfig.type,
      linkedin_url: `https://linkedin.com/in/${username}`,
      linkedin_username: username,
      relationship_strength: sourceConfig.strength,
      warm_source_detail: sourceDetail,
      message: `Met through LinkedIn - ${sourceDetail}`
    }
  })
}

/**
 * Generate mock warm leads for all sources
 */
export function generateMockWarmLeads(config: {
  facebook?: number
  google_contacts?: number
  linkedin?: number
}): MockWarmLead[] {
  const leads: MockWarmLead[] = []

  if (config.facebook && config.facebook > 0) {
    leads.push(...generateMockFacebookLeads(config.facebook))
  }

  if (config.google_contacts && config.google_contacts > 0) {
    leads.push(...generateMockGoogleContactsLeads(config.google_contacts))
  }

  if (config.linkedin && config.linkedin > 0) {
    leads.push(...generateMockLinkedInLeads(config.linkedin))
  }

  return leads
}

/**
 * Ingest mock warm leads via the ingest API
 * Used for E2E testing
 */
export async function ingestMockWarmLeads(
  leads: MockWarmLead[],
  authToken?: string
): Promise<{ success: boolean; summary: unknown }> {
  const secret = process.env.N8N_INGEST_SECRET

  if (!secret) {
    throw new Error('N8N_INGEST_SECRET not configured')
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/outreach/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`
    },
    body: JSON.stringify({ leads })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to ingest mock leads: ${response.status} ${error}`)
  }

  return await response.json()
}

/**
 * Generate a single test lead for quick testing
 */
export function generateSingleTestLead(source: 'facebook' | 'google_contacts' | 'linkedin'): MockWarmLead {
  const firstName = 'Test'
  const lastName = 'User'
  const timestamp = Date.now()

  const sourceMap = {
    facebook: 'warm_facebook_friends',
    google_contacts: 'warm_google_contacts',
    linkedin: 'warm_linkedin_connections'
  }

  return {
    name: `${firstName} ${lastName}`,
    email: `test-${source}-${timestamp}@test.amadutown.com`,
    company: 'Test Company',
    company_domain: 'testcompany.com',
    job_title: 'Test Manager',
    industry: 'Technology',
    location: 'San Francisco, CA',
    lead_source: sourceMap[source],
    linkedin_url: source === 'linkedin' ? `https://linkedin.com/in/test-${timestamp}` : undefined,
    linkedin_username: source === 'linkedin' ? `test-${timestamp}` : undefined,
    facebook_profile_url: source === 'facebook' ? `https://facebook.com/test-${timestamp}` : undefined,
    phone_number: source === 'google_contacts' ? `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}` : undefined,
    relationship_strength: 'strong',
    warm_source_detail: `Test ${source} lead`,
    message: `Test lead from ${source}`
  }
}
