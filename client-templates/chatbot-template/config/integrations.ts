/**
 * Integrations Configuration
 *
 * Reads connection settings from environment variables.
 * You should NOT need to edit this file — set values in .env.local instead.
 * This file is YOUR territory — updates from the template will never overwrite it.
 */

const integrations = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },

  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL || '',
  },

  vapi: {
    publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '',
    assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '',
  },
}

export default integrations
