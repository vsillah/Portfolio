import fs from 'node:fs/promises';
import path from 'node:path';

const qaDir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(qaDir, '../../..');
const catalog = JSON.parse(await fs.readFile(path.join(qaDir, 'catalog-snapshot.json'), 'utf8'));
const inventory = JSON.parse(await fs.readFile(path.join(qaDir, 'asset-inventory.json'), 'utf8'));
const sources = JSON.parse(await fs.readFile(path.join(qaDir, 'generation-source-map.json'), 'utf8'));
const galleryPath = path.join(root, 'lib/service-concept-gallery.json');
const gallery = JSON.parse(await fs.readFile(galleryPath, 'utf8'));

const slugs = {
  'Accelerated Cohort Workshop': 'accelerated-cohort-workshop',
  'Product Innovation Workshop': 'product-innovation-workshop',
  'AI Customer Support Chatbot': 'customer-support-chatbot',
  'AI Inbound Lead Chatbot': 'inbound-lead-chatbot',
  'Management Consulting': 'management-consulting',
  'AI Voice Agent — Inbound': 'voice-agent-inbound',
  'Lead Generation Workflow Agent': 'lead-generation-workflow',
  'Social Media Content Agent': 'social-media-content-agent',
  'Client Onboarding Automation': 'client-onboarding-automation',
  'Inbound Lead Tracking System': 'inbound-lead-tracking',
  'Mobile App Generation': 'mobile-app-generation',
  'Website Development': 'website-development',
  'AI Email Sequence Builder': 'ai-email-sequence-builder',
  'RAG Knowledge Base System': 'rag-knowledge-base',
  'AI Strategy Workshop — Half-Day': 'ai-strategy-half-day',
  'AI Strategy Workshop — Full-Day': 'ai-strategy-full-day',
  'Monthly Advisory Retainer': 'monthly-advisory',
  'Priority Support Channel': 'priority-support-channel',
  'Data Migration & Onboarding': 'data-migration-onboarding',
  'Custom API / ERP Integrations': 'custom-api-erp',
  'Custom Reporting & Analytics Dashboard': 'custom-reporting-dashboard',
  'AI Strategy Workshop — Recorded (Self-Paced)': 'ai-strategy-recorded',
  'Pre-Built Chatbot Template — Self-Install': 'chatbot-self-install',
  'Community Forum Access': 'community-forum',
  '30-Day Email Support': 'thirty-day-email',
  '60-Day Email Support': 'sixty-day-email',
  'Lead Tracking Templates': 'lead-tracking-templates',
  'Content Automation Templates': 'content-automation-templates',
  'Shared Analytics Dashboard': 'shared-analytics-dashboard',
  'AI Email Sequence Templates': 'ai-email-sequence-templates',
};

const descriptions = {
  'accelerated-cohort-workshop': ['A facilitator helping a laptop-based cohort run an AI product exercise', 'Cohort participants behind laptops comparing a product experiment canvas'],
  'product-innovation-workshop': ['Product workshop participants behind laptops testing paper prototypes', 'Participants behind laptops reviewing a journey map with a facilitator'],
  'ai-strategy-half-day': ['Half-day AI strategy workshop participants behind laptops prioritizing use cases', 'Participants behind laptops sorting blank opportunity cards with a facilitator'],
  'ai-strategy-full-day': ['Full-day AI strategy workshop teams behind laptops mapping workflows', 'Full-day participants behind laptops planning an implementation sequence'],
  'ai-strategy-recorded': ['A self-paced AI strategy workshop learner taking notes behind a laptop', 'A learner behind a laptop completing an AI opportunity worksheet'],
  'management-consulting': ['Vambah and one client reviewing a decision memo across a table', 'Vambah and one client reviewing a decision memo and laptop side by side'],
  'customer-support-chatbot': ['Two colleagues reviewing a support chatbot handoff on a laptop', 'A support specialist and colleague checking a chatbot escalation map'],
  'voice-agent-inbound': ['Two colleagues testing an inbound voice agent handoff at a laptop', 'A headset-wearing specialist and colleague checking call routing'],
  'inbound-lead-chatbot': ['A small business owner and sales colleague reviewing a website inquiry on a laptop', 'Two professionals mapping an inbound inquiry to human handoff'],
  'lead-generation-workflow': ['Two sales colleagues reviewing an inbound lead queue on a laptop', 'Two professionals reviewing a source-to-CRM workflow diagram'],
  'ai-email-sequence-builder': ['A marketer and owner sequencing draft email cards beside a laptop', 'An editor and client reviewing blank email cards and an unlettered timeline'],
  'data-migration-onboarding': ['A specialist and client operations lead mapping old-to-new data fields', 'An analyst and reviewer reconciling records with an unlettered chart'],
};

const sheetBySlug = new Map(sources.sheets.map(item => [item.slug, item]));
const assets = new Map(inventory.map(item => [`${item.slug}:${item.role}`, item]));
const audit = catalog.map(service => {
  if (service.title === 'Website UX Refresh') {
    return { ...service, decision: 'keep', reason: 'Named built example and review artifact match the UX refresh offer.' };
  }
  const slug = slugs[service.title];
  if (!slug) throw new Error(`No visual slug for ${service.title}`);
  const workshop = /workshop|cohort/i.test(service.title);
  const sceneCategory = workshop ? 'workshop' : 'consulting';
  const sheet = sheetBySlug.get(slug);
  const text = descriptions[slug] || [sheet?.left, sheet?.right];
  if (!text?.[0] || !text?.[1]) throw new Error(`Missing scene descriptions for ${service.title}`);
  const frames = ['hero', 'secondary'].map((role, index) => {
    const asset = assets.get(`${slug}:${role}`);
    if (!asset) throw new Error(`Missing ${role} for ${service.title}`);
    return { ...asset, alt: `Illustrative scene: ${text[index]}`, sceneCategory };
  });
  gallery[service.id] = {
    ...gallery[service.id],
    calibration: '2026-11-02-photographic-service-review',
    frames: frames.map((frame, index) => ({
      imageUrl: frame.imageUrl,
      alt: frame.alt,
      role: index === 0 ? 'hero' : 'product-in-use',
      status: 'illustrative concept',
      label: 'Illustrative scene',
    })),
  };
  return {
    ...service, slug, decision: 'replace',
    reason: workshop
      ? 'Editorial poster or worksheet did not show active laptop-based workshop participation.'
      : service.title === 'AI Inbound Lead Chatbot'
        ? 'Robot-led stock concept and generic conversation art did not credibly show the inquiry and human handoff.'
        : 'Editorial page or prototype board did not provide a credible photographic service scene.',
    sceneCategory, frames,
  };
});

if (audit.length !== 31 || audit.filter(item => item.decision === 'replace').length !== 30 || audit.filter(item => item.decision === 'keep').length !== 1) {
  throw new Error('Expected 31 audited services: 30 replacements and one kept gallery');
}
await fs.writeFile(path.join(qaDir, 'service-gallery-audit.json'), `${JSON.stringify(audit, null, 2)}\n`);
await fs.writeFile(galleryPath, `${JSON.stringify(gallery, null, 2)}\n`);
console.log('Bound 30 photographic galleries; retained Website UX Refresh and Speaking Engagement');
