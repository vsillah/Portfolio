/**
 * Branding Configuration
 *
 * Customize your chatbot's appearance here.
 * This file is YOUR territory — updates from the template will never overwrite it.
 */

const branding = {
  businessName: 'My Business',
  chatTitle: 'AI Assistant',
  welcomeMessage: "Hi! I'm here to help. How can I assist you today?",
  inputPlaceholder: 'Ask me anything...',

  suggestedActions: [
    { id: 'services', label: 'Learn About Services', message: 'What services do you offer?', description: 'Explore our offerings' },
    { id: 'pricing', label: 'Get Pricing', message: 'Can you tell me about pricing?', description: 'View pricing options' },
    { id: 'contact', label: 'Contact Us', message: 'I would like to speak with someone', description: 'Get in touch' },
  ],

  colors: {
    primary: '#3b82f6',
    userBubble: 'bg-blue-500 text-white',
    assistantBubble: 'bg-gray-100 border border-gray-200 text-gray-800',
    supportBubble: 'bg-emerald-100 border border-emerald-200 text-gray-800',
    userAvatar: 'bg-blue-500 text-white',
    assistantAvatar: 'bg-gray-200 text-gray-700',
    supportAvatar: 'bg-emerald-500 text-white',
    sendButton: 'bg-blue-500 hover:bg-blue-600',
    activeIndicator: 'bg-emerald-500',
    voiceActiveIndicator: 'bg-blue-500',
  },

  pageTitle: 'Chatbot Template',
  pageDescription: 'AI Chatbot with n8n RAG integration and optional voice chat',
} as const

export default branding
