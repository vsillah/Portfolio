# Site Help Guide

Welcome! This guide covers everything you need to know to navigate and use the site. Use the table of contents below to jump to any section.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Home Page](#home-page)
3. [Store](#store)
4. [Services](#services)
5. [Pricing & Packages](#pricing--packages)
6. [Shopping Cart & Checkout](#shopping-cart--checkout)
7. [Your Purchases](#your-purchases)
8. [Proposals](#proposals)
9. [Onboarding](#onboarding)
10. [Lead Magnets](#lead-magnets)
11. [AI Readiness Scorecard](#ai-readiness-scorecard)
12. [Your Account](#your-account)
13. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## Getting Started

The site is a portfolio and storefront where you can explore projects, browse products and services, make purchases, and access free resources.

### Navigation

- **Menu**: Click the hamburger menu icon (three lines) in the upper-right corner of the home page to open the full navigation menu. From there you can jump to any section or page.
- **Help**: Click the **?** icon in the upper-right corner on any page to return to this guide.
- **User menu**: If you are logged in, click your avatar/name in the upper-right to access your account options (Lead Magnets, My Purchases, Sign Out).

---

## Home Page

The home page is a single scrollable portfolio page with the following sections:

| Section | What You'll Find |
|---------|-----------------|
| **Hero** | Introduction, three mission cards (Community, Funding, Dogfooding), and call-to-action |
| **Projects** | Featured projects and case studies |
| **Prototypes** | Interactive app prototypes and demos |
| **Services** | Overview of available services |
| **Publications** | Published articles, books, and papers |
| **Music** | Original music and audio content |
| **Videos** | Video content and presentations |
| **Merchandise** | Featured merchandise items |
| **About** | Background and bio |
| **Contact** | Contact form to get in touch |

**Tip**: Use the navigation menu to jump directly to any section. Each section name in the menu corresponds to a scroll anchor on the home page.

The **Prototypes** section is also available as a standalone page at `/prototypes` for a focused view.

---

## Store

The Store page (`/store`) is where you can browse and purchase digital products and physical merchandise.

### Browsing

- **Category tabs**: Toggle between **All**, **Products**, and **Services** to narrow what you see.
- **Search**: Use the search bar at the top to find items by title or description.
- **Type filter**: When viewing Products or Services specifically, a type dropdown appears so you can filter further (e.g., E-Books, Music, Merchandise, Training, Consulting).
- **Featured toggle**: Click the **Featured** button to show only highlighted items.

### Product Types

| Type | Description |
|------|-------------|
| E-Books | Downloadable digital books |
| Training | Training materials and courses |
| Calculators | Interactive calculator tools |
| Music | Original music tracks |
| Apps | Software applications |
| Merchandise | Physical print-on-demand items (apparel, housewares, travel, office) |

### Product Details

Click any product card to view its detail page. On the detail page you will find:

- **Product image** or mockup viewer (for merchandise)
- **Description** and pricing
- **Variant selector** for merchandise items (size, color, style) -- you must select a variant before adding to cart
- **Size chart** for apparel items
- **Shipping info** for print-on-demand items (typically 2-7 business days; free shipping on orders over $75)

### Adding to Cart

Click the **Add to Cart** button on any product card or detail page. For merchandise, select a variant first. A brief "Added!" confirmation will appear. The cart count badge updates in real time.

---

## Services

The Services page (`/services`) showcases professional services available for booking.

### Service Types

| Type | Description |
|------|-------------|
| Training | Structured training programs |
| Speaking | Speaking engagements and keynotes |
| Consulting | Professional consulting services |
| Coaching | One-on-one or group coaching |
| Workshop | Hands-on workshop sessions |
| Warranty & Guarantees | Service warranty and guarantee packages |

### Filters

- **Service type dropdown**: Filter by the type of service.
- **Delivery method dropdown**: Filter by Virtual, In-Person, or Hybrid delivery.
- **Featured toggle**: Show only highlighted services.
- **Search bar**: Search by title or description.

### Booking a Service

- **Fixed-price services**: Click **Add to Cart** to add directly, then proceed to checkout.
- **Quote-based services**: Click **Request Quote** to be taken to the contact form with the service pre-selected.

---

## Pricing & Packages

**Route**: `/pricing`

The Pricing page shows Amadutown's bundled AI solution tiers, an interactive ROI calculator, ongoing support plans, and a competitive comparison.

### How to Access

- Click **Pricing** in the navigation menu.
- Click **See Pricing & Packages** from the Store or Services sections on the homepage.
- Click **View Pricing** from the Hero section on the homepage.

### Segment Selector

Use the segment toggle at the top of the pricing page to see packages tailored to your business size:

- **Small Business (1-50 employees)**: Shows the Quick Win, Accelerator, and Growth Engine tiers.
- **Mid-Market (50-500 employees)**: Shows the Accelerator, Growth Engine, and Digital Transformation tiers.

### Pricing Tiers

Each tier is a bundled "Grand Slam Offer" that includes a mix of products, services, and support:

| Tier | Starting Price | Best For |
|------|---------------|----------|
| AI Quick Win | $997 | Solopreneurs exploring AI |
| AI Accelerator | $7,497 | Small businesses deploying first AI tools |
| Growth Engine | $14,997 | Growing businesses scaling with AI |
| Digital Transformation | from $29,997 | Mid-market comprehensive AI |

Every tier includes an **outcome-based guarantee** — if you don't achieve the promised results, Amadutown continues working with you at no additional cost.

### ROI Calculator

The interactive ROI calculator on the pricing page lets you:

1. Select your **industry** from a dropdown.
2. Select your **company size**.
3. Click **Calculate My ROI** to see estimated annual waste, potential savings, ROI multiple, and payback period.

These are conservative estimates based on industry benchmarks. For personalized projections, schedule a free AI audit.

### Continuity Plans

After your initial project, continuity plans provide ongoing support:

- **AI Growth Partner** ($497/mo): Group coaching, resource library, basic maintenance.
- **AI Advisory Retainer** ($2,500/mo): 1-on-1 advisory, priority support, full maintenance.
- **White-Label License** ($5,000/mo): Brand tools under your company name.

### Personalized Pricing

After an AI audit or diagnostic session, you may receive a link to your **personalized pricing page** (`/pricing/custom?sessionId=...`). This page shows:

- Your specific pain points and their annual cost.
- A recommended tier based on your business situation.
- Projected ROI based on your actual data.
- A comparison of all available tiers.

---

## Shopping Cart & Checkout

### Viewing Your Cart

After adding items, click the **View Cart** button (visible on the Store and Services pages when your cart has items) or navigate directly to `/checkout`.

### Checkout Flow

The checkout process has two main steps:

#### Step 1: Contact Information (guests only)

If you are not logged in, you will be asked to provide your name and email address. Logged-in users skip this step automatically.

#### Step 2: Review Order

On the review screen you can:

- **View all items** in your order with prices
- **Change quantities** for any item using the +/- controls
- **Change variants** for merchandise items
- **Remove items** from your order
- **Apply a discount code** using the discount code form -- enter your code and click Apply

The order summary shows:

- Subtotal
- Any discounts applied
- Final total

#### Completing Your Purchase

- **Paid orders**: Click **Proceed to Payment** to enter your payment details securely via Stripe.
- **Free orders**: If your total is $0 (e.g., free items or a 100% discount), click **Complete Free Order** to finish instantly.

### Payment

Payment is processed securely through Stripe. You will be asked to enter your card details on a secure payment form. After successful payment, you will be redirected to your purchases page.

---

## Your Purchases

The Purchases page (`/purchases`) shows your order history and lets you access your digital products.

### Viewing Orders

- All your past orders are listed with the date, item count, total amount, and status.
- Click any order to view its full details.
- For orders that include physical merchandise, the order detail page shows **Shipping** status (e.g. Processing, Shipped, Delivered) and a **Track package** link when tracking is available.

### Order status and tracking

- You can check the status of your orders anytime on the **My Purchases** page (`/purchases`). Open an order to see payment status, shipping status, and tracking (when available).
- When signed in, you can also ask the site chatbot **"What's the status of my order?"** or use the **Check my order status** suggestion; the assistant will use your recent order and shipping information to respond.

### Downloading Digital Products

For completed orders containing digital products (E-Books, music, apps, etc.):

- A **Download Manager** section appears showing all downloadable files.
- Click the download button next to any file to download it.
- Downloads are tracked so you can always return to re-download your purchases.

### Sharing & Referrals

- **Social Share**: Share your purchase on social media directly from the order detail page.
- **Referral Program**: Access the referral program to share with friends and earn rewards.

### Guest Access

If you completed a purchase without an account, you can access your specific order using the direct order link provided in your confirmation email.

---

## Proposals

If you have been sent a proposal, you can view it at its unique URL (`/proposal/[id]`).

### What's in a Proposal

- **Client information** and proposal header
- **Value Assessment**: A detailed section showing ROI calculations, pain point analysis, and confidence levels
- **Line items**: The services or deliverables included, with individual pricing
- **Totals**: Subtotal, any discounts, and final price
- **Terms & conditions**

### Proposal Actions

- **Accept Proposal**: Click the accept button to agree to the terms. This will create a Stripe checkout session.
- **Proceed to Payment**: After accepting, complete payment through Stripe.
- **Download PDF**: Download a PDF version of the proposal for your records.
- **View Methodology**: Expand the methodology section to understand the value assessment approach.

### Proposal Statuses

| Status | Meaning |
|--------|---------|
| Pending | Awaiting your review |
| Accepted | You accepted; payment may still be pending |
| Paid | Payment completed successfully |
| Expired | The proposal is no longer valid |

---

## Onboarding

After a proposal is accepted and paid, you may receive an onboarding plan (`/onboarding/[id]`).

### Onboarding Sections

The onboarding plan is divided into collapsible sections:

1. **Setup & Access Requirements** -- What needs to be configured before work begins. Items marked with "Client Action" require your input.
2. **Expected Milestones** -- Key deliverables and their current status (pending, in progress, complete, or skipped).
3. **Communication Plan** -- How and when we will communicate during the engagement.
4. **Win Conditions** -- Measurable criteria that define project success.
5. **Warranty Period** -- Details about any warranty coverage included with the engagement.
6. **Artifacts Handoff** -- Files, documents, and deliverables you will receive.

### Quick Navigation

Use the section links at the top of the onboarding page to jump directly to any section.

### Booking a Call

Click the **Book Onboarding Call** button to schedule your kickoff call via Calendly.

### Download

Click the **Download PDF** link to save a copy of your onboarding plan.

---

## Lead Magnets

The Lead Magnets page (`/lead-magnets`) provides access to free downloadable resources. You can also use the **Resources** page (`/resources`), which includes the AI Readiness Scorecard and the same templates and playbooks.

> **Note**: You must be logged in to access lead magnets. If you are not logged in, you will be redirected to the login page.

### How It Works

1. Browse the list of available resources.
2. Click the download button on any item.
3. The file will be downloaded to your device.
4. Download counts are tracked per resource.

---

## AI Readiness Scorecard

On the **Resources** page (`/resources`) you can take the **AI Readiness Scorecard**: a short assessment that scores how ready your organization is for AI (0–10) and gives you tailored next steps.

### How It Works

1. **Start** — Click to begin the scorecard on the Resources page.
2. **Answer** — Answer a few questions about your data, team, goals, and resources. You can move back and forth between questions.
3. **See your score** — You’ll see your score out of 10 and a short teaser.
4. **Get full results** — Enter your email (and optionally your name) to unlock the full result: a band (Getting started / Building / Ready) with a summary and recommended actions.
5. **Results** — The full result is shown on the same page. You can use it to plan next steps or share with your team.

Your response is saved with your email so we can follow up with relevant resources. The same lead qualification workflow used for the contact form may use your score to tailor outreach.

---

## Your Account

### Creating an Account

1. Click the **Login** button in the upper-right corner of the home page.
2. On the login page, switch to the **Sign Up** option.
3. Enter your email and choose a password.
4. You will be redirected back to the site once registration is complete.

### Logging In

1. Click the **Login** button in the upper-right corner.
2. Enter your email and password.
3. After logging in, your avatar and name appear in the upper-right corner.

### User Menu

When logged in, click your avatar to open the user menu:

- **Lead Magnets** -- Access free downloadable resources
- **My Purchases** -- View your order history and downloads
- **Admin Dashboard** -- (visible only to administrators)
- **Sign Out** -- Log out of your account

### Logging Out

Open the user menu and click **Sign Out**. You will be redirected to the home page.

---

## FAQ & Troubleshooting

### I can't find my purchase / download

- Make sure you are logged in with the same email you used at checkout.
- Go to **My Purchases** from the user menu.
- If you checked out as a guest, use the direct order link from your confirmation email.

### My payment failed

- Double-check your card details and try again.
- Ensure your card has sufficient funds and is not blocked for online transactions.
- Try a different payment method.
- If the issue persists, use the **Contact** form on the home page to reach out for assistance.

### My discount code isn't working

- Discount codes are case-sensitive -- enter them exactly as received.
- Some codes may be expired or limited to specific products.
- If you believe the code should work, contact support via the Contact form.

### I can't access Lead Magnets

- Lead Magnets require a logged-in account. Click **Login** in the upper-right corner to sign in or create an account.

### My merchandise order hasn't arrived

- Print-on-demand items typically ship within 2-7 business days after ordering.
- Check **My Purchases** and open your order to see shipping status and a **Track package** link when it’s available. You can also ask the chatbot **"What's the status of my order?"** when signed in.
- Check your email for shipping confirmation and tracking information.
- If it has been more than 14 business days, contact support.

### How do I request a quote for a service?

- Go to the **Services** page.
- Find the service you are interested in.
- Click **Request Quote** -- this will take you to the contact form with the service pre-selected.

### How do I accept a proposal?

- Open the proposal link you received.
- Review the value assessment, line items, and terms.
- Click **Accept Proposal** and then complete payment through Stripe.

### How do I book an onboarding call?

- After your proposal is paid, visit your onboarding plan page.
- Click **Book Onboarding Call** to schedule via Calendly.

### I need further help

Use the **Contact** section on the home page to send a message. Include as much detail as possible about your issue, and you will receive a response promptly.
