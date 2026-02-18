# Lead Generation Template

Complete lead capture, qualification, and sales enablement system.

## Features

- Contact form with customizable fields
- Lead magnet delivery with download tracking
- Exit intent popup for lead capture
- n8n webhook integration for lead qualification
- Diagnostic assessment tracking
- Sales dashboard for follow-up
- Lead scoring and qualification status

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials.

### 3. Set Up Database

Run `database/schema.sql` in your Supabase SQL editor.

### 4. Run Development Server

```bash
npm run dev
```

## Usage

### Contact Form

```tsx
import { ContactForm } from '@/components/ContactForm'

export default function Page() {
  return (
    <ContactForm
      interestOptions={[
        { value: 'consulting', label: 'Consulting' },
        { value: 'development', label: 'Development' },
      ]}
      showRevenue={true}
      showDecisionMaker={true}
      onSuccess={(id) => console.log('Lead created:', id)}
    />
  )
}
```

### Exit Intent Popup

```tsx
import { ExitIntentPopup } from '@/components/ExitIntentPopup'

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ExitIntentPopup
        title="Wait! Get our free guide"
        description="Download our exclusive resource before you leave."
        ctaText="Get Free Guide"
        captureEmail={true}
        onEmailSubmit={(email) => {
          // Handle email capture
        }}
      />
    </>
  )
}
```

## n8n Workflow

### Lead Qualification Workflow

Triggered on contact form submission:

```
Webhook → Company Enrichment → Lead Scoring → Update Supabase → Notify Sales
```

Expected payload:
```json
{
  "name": "John Doe",
  "email": "john@company.com",
  "company": "Company Inc",
  "companyDomain": "company.com",
  "linkedinUrl": "linkedin.com/in/johndoe",
  "message": "Interested in your services",
  "annualRevenue": "1m_5m",
  "interestAreas": ["consulting", "technology"],
  "submissionId": "123",
  "source": "contact_form"
}
```

Update Supabase with:
- `lead_score` (0-100)
- `qualification_status` (pending/qualified/hot/warm/cold)
- `full_report` (enrichment data)

### Diagnostic Completion Workflow

Triggered when a diagnostic assessment is completed:

```
Webhook → Format Data → Notify Sales Team → Create CRM Entry
```

## File Structure

```
leadgen-template/
├── app/
│   └── api/
│       └── contact/route.ts
├── components/
│   ├── ContactForm.tsx
│   └── ExitIntentPopup.tsx
├── lib/
│   ├── supabase.ts
│   ├── n8n.ts
│   ├── exitIntent.ts
│   └── utils.ts
├── database/
│   └── schema.sql
├── .env.example
├── package.json
└── README.md
```

## Customization

### Interest Options

Update the `interestOptions` prop on `ContactForm` and the `interestLabels` map in `app/api/contact/route.ts`.

### Lead Scoring

Configure your n8n workflow to calculate scores based on:
- Company size
- Revenue range
- Decision maker status
- Interest areas
- LinkedIn presence

### Exit Intent Triggers

Customize timing and behavior in `ExitIntentPopup`:
- `delay`: Time before popup can trigger (ms)
- `storageKey`: Prevent showing again in same session

## License

MIT
