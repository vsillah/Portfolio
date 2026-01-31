# Portfolio Test Plan

A comprehensive manual test plan to validate functionality after major updates. Run through this checklist to ensure nothing is broken.

---

## Quick Test Summary

| Area | Critical Tests | Est. Time |
|------|---------------|-----------|
| Navigation | 5 tests | 3 min |
| Authentication | 8 tests | 5 min |
| Home Page Sections | 9 tests | 10 min |
| Store & Cart | 12 tests | 10 min |
| Checkout | 8 tests | 8 min |
| Contact & Chat | 6 tests | 5 min |
| Prototypes | 7 tests | 5 min |
| Admin Dashboard | 10 tests | 10 min |
| Responsive Design | 6 tests | 5 min |
| Performance | 4 tests | 3 min |
| **Total** | **87 tests** | **~75 min** |

---

## Pre-Test Setup

Before running tests, ensure:
- [ ] Development server is running (`npm run dev`)
- [ ] Database is connected (Supabase)
- [ ] Environment variables are configured
- [ ] You have test accounts ready:
  - Regular user account
  - Admin user account
- [ ] Browser dev tools are open (Console tab for errors)

---

## 1. Navigation & Layout

### 1.1 Navigation Bar
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Logo displays | Load homepage | AmaduTown logo visible in nav | ☐ |
| Nav scroll behavior | Scroll down page | Nav becomes semi-transparent with blur | ☐ |
| Hamburger menu opens | Click hamburger icon | Full navigation dropdown appears | ☐ |
| Section links work | Click each nav link | Smooth scroll to correct section | ☐ |
| Menu closes after click | Click nav item | Menu closes, scrolls to section | ☐ |

### 1.2 Navigation Links
Test each section link scrolls to correct area:
- [ ] Home
- [ ] Projects
- [ ] Prototypes
- [ ] Publications
- [ ] Music
- [ ] Videos
- [ ] Store
- [ ] About
- [ ] Contact

---

## 2. Authentication

### 2.1 Login Flow
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Login page loads | Navigate to `/auth/login` | Login form displays | ☐ |
| Email validation | Enter invalid email, submit | Error message shown | ☐ |
| Password required | Leave password empty, submit | Error message shown | ☐ |
| Valid login | Enter valid credentials | Redirect to homepage, user menu appears | ☐ |
| Invalid credentials | Enter wrong password | "Invalid credentials" error | ☐ |

### 2.2 Signup Flow
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Signup page loads | Navigate to `/auth/signup` | Signup form displays | ☐ |
| Password match validation | Enter mismatched passwords | Error shown | ☐ |
| Successful signup | Complete valid signup | Confirmation message/redirect | ☐ |

### 2.3 OAuth Authentication
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Google OAuth button | Click "Google" | Redirects to Google auth | ☐ |
| GitHub OAuth button | Click "GitHub" | Redirects to GitHub auth | ☐ |
| OAuth callback | Complete OAuth flow | Returns to site, logged in | ☐ |

### 2.4 User Session
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| User menu displays | Login, view nav | Avatar with first letter shows | ☐ |
| User dropdown | Click user avatar | Dropdown with options appears | ☐ |
| Sign out | Click "Sign Out" | Session ends, redirect to home | ☐ |
| Session persistence | Refresh page when logged in | Session maintained | ☐ |

---

## 3. Home Page Sections

### 3.1 Hero Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Hero renders | Load homepage | Hero section with name/title visible | ☐ |
| Background animations | Observe hero | FlowingMesh animation plays | ☐ |

### 3.2 Projects Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Projects load | Scroll to Projects | Project cards display | ☐ |
| Project images | View project cards | Images load correctly | ☐ |
| Project links | Click project card | Opens project details/link | ☐ |

### 3.3 Prototypes Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Prototypes load | Scroll to Prototypes | Prototype cards display | ☐ |
| Filter by stage | Use stage filter | Results filter correctly | ☐ |
| Filter by channel | Use channel filter | Results filter correctly | ☐ |
| Filter by type | Use type filter | Results filter correctly | ☐ |
| Clear filters | Clear all filters | All prototypes shown | ☐ |

### 3.4 Publications Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Publications load | Scroll to Publications | Publication cards display | ☐ |
| Book covers | View publications | Cover images display | ☐ |

### 3.5 Music Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Music load | Scroll to Music | Music items display | ☐ |
| Audio preview | Play button (if any) | Audio plays | ☐ |

### 3.6 Videos Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Videos load | Scroll to Videos | Video thumbnails display | ☐ |
| Video links | Click video | Opens video or plays | ☐ |

### 3.7 Store Section (Home Preview)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Products load | Scroll to Store | Up to 6 products display | ☐ |
| Featured first | Check order | Featured items appear first | ☐ |
| Price display | View cards | Prices shown correctly | ☐ |
| "View Product" click | Click product | Navigates to product detail | ☐ |
| "Explore Boutique" | Click link | Navigates to /store | ☐ |

### 3.8 About Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| About renders | Scroll to About | Bio content displays | ☐ |
| Profile image | View section | Profile photo loads | ☐ |

### 3.9 Contact Section
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Contact renders | Scroll to Contact | Contact options visible | ☐ |
| Social links | Click social icons | Open correct social profiles | ☐ |
| Email link | Click email | Opens mail client | ☐ |

---

## 4. Store & Shopping Cart

### 4.1 Store Page (`/store`)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Store page loads | Navigate to `/store` | All products display | ☐ |
| Product types shown | View products | Type badges visible | ☐ |
| Free vs paid | View products | Prices show correctly | ☐ |
| Product click | Click product card | Navigates to detail page | ☐ |

### 4.2 Product Detail Page (`/store/[id]`)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Detail page loads | Click any product | Product details display | ☐ |
| Image displays | View detail | Product image loads | ☐ |
| Description shown | View detail | Full description visible | ☐ |
| Price correct | View detail | Price matches listing | ☐ |
| Add to cart button | View detail | Button visible and enabled | ☐ |
| Add to cart action | Click "Add to Cart" | Item added, cart updates | ☐ |

### 4.3 Shopping Cart
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Cart opens | Click cart icon | Cart sidebar slides in | ☐ |
| Empty cart message | Open empty cart | "Your cart is empty" shown | ☐ |
| Items display | Add items, open cart | Items show with details | ☐ |
| Quantity increase | Click "+" button | Quantity increments, total updates | ☐ |
| Quantity decrease | Click "-" button | Quantity decrements (min 1) | ☐ |
| Remove item | Click trash icon | Item removed from cart | ☐ |
| Clear cart | Click "Clear Cart" | Confirmation, then cart empties | ☐ |
| Subtotals correct | Add multiple items | Per-item subtotals correct | ☐ |
| Total correct | View cart footer | Total calculates correctly | ☐ |
| Close cart | Click X or backdrop | Cart closes | ☐ |
| Cart persists | Add items, refresh | Items still in cart | ☐ |

---

## 5. Checkout Flow

### 5.1 Checkout Page (`/checkout`)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Checkout loads | Click "Proceed to Checkout" | Checkout page displays | ☐ |
| Order summary shown | View page | Items and totals displayed | ☐ |
| Contact form | View page | Name, email fields present | ☐ |

### 5.2 Contact Form
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Required fields | Submit empty form | Validation errors shown | ☐ |
| Email validation | Enter invalid email | Error shown | ☐ |
| Valid submission | Fill valid data | Proceeds to payment | ☐ |

### 5.3 Discount Codes
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Discount input | View checkout | Discount code field present | ☐ |
| Invalid code | Enter bad code | "Invalid code" error | ☐ |
| Valid code | Enter valid code | Discount applied to total | ☐ |

### 5.4 Payment (Stripe)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Payment form loads | Complete contact info | Stripe Elements appear | ☐ |
| Card validation | Enter invalid card | Error message shown | ☐ |
| Test card success | Use test card 4242... | Payment processes | ☐ |
| Order confirmation | Complete payment | Success message/redirect | ☐ |

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires Auth: `4000 0025 0000 3155`

---

## 6. Contact & Chat

### 6.1 Contact Form
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Tab switching | Click "Send Message" tab | Form displays | ☐ |
| Form validation | Submit empty | Validation errors | ☐ |
| Successful submit | Fill and submit | Success message appears | ☐ |
| Reset after submit | After success | Form fields clear | ☐ |

### 6.2 Chat Component
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Chat toggle | Click "Chat Now" | Chat expands | ☐ |
| Welcome message | Open chat | Welcome message displays | ☐ |
| Suggested actions display | Open chat | "Things you can ask me" section shows | ☐ |
| Send message | Type and send | Message appears, AI responds | ☐ |
| Loading indicator | Send message | Typing indicator shows | ☐ |
| Clear chat | Click trash icon | Chat resets, new session | ☐ |
| Minimize chat | Click X | Chat collapses to button | ☐ |
| Suggestions hide on message | Send any message | Suggestions disappear | ☐ |

### 6.3 Chat Diagnostic Feature
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Diagnostic trigger via suggestion | Click "Perform an AI Audit" | Diagnostic mode activates | ☐ |
| Diagnostic trigger via text | Type "I want an audit" | Diagnostic mode activates | ☐ |
| Diagnostic trigger phrases | Try various phrases (audit, diagnostic, identify issues) | All trigger diagnostic mode | ☐ |
| Diagnostic progress indicator | Start diagnostic | Progress banner shows current category | ☐ |
| Diagnostic mode header | In diagnostic mode | Header shows "Diagnostic Mode" with icon | ☐ |
| Category progression | Answer questions | Progress updates, category changes | ☐ |
| Diagnostic data saves | Answer questions | Data saved incrementally to database | ☐ |
| Diagnostic completion | Complete all categories | Status changes to "completed" | ☐ |
| Diagnostic links to contact | Complete diagnostic with email | Links to contact_submissions table | ☐ |
| Diagnostic triggers lead webhook | Complete diagnostic | Lead qualification webhook fires | ☐ |
| Exit diagnostic mode | Type "exit" or clear chat | Diagnostic mode ends | ☐ |
| Diagnostic persists on refresh | Start diagnostic, refresh page | Diagnostic state restored | ☐ |

---

## 7. Prototypes

### 7.1 Prototypes Page (`/prototypes`)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Page loads | Navigate to `/prototypes` | Full prototypes list | ☐ |
| Filters work | Apply filters | Results filter correctly | ☐ |
| Prototype card click | Click card | Opens detail/demo | ☐ |

### 7.2 Prototype Features
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Demo selector | Click prototype | Demo options appear | ☐ |
| Enrollment (logged in) | Click enroll button | Enrollment processes | ☐ |
| Feedback form | Access feedback | Form displays and submits | ☐ |
| Stage badge | View card | Correct stage shown | ☐ |

---

## 8. Admin Dashboard

**Prerequisites:** Must be logged in as admin user

### 8.1 Access Control
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Admin link in menu | Login as admin | "Admin Dashboard" appears | ☐ |
| Non-admin blocked | Login as regular user | Admin link not shown | ☐ |
| Direct URL blocked | Regular user visits `/admin` | Redirect or access denied | ☐ |

### 8.2 Admin Dashboard (`/admin`)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Dashboard loads | Navigate to `/admin` | Dashboard displays | ☐ |
| Analytics summary | View dashboard | Stats cards show data | ☐ |
| Content management | View dashboard | Content type cards present | ☐ |

### 8.3 Content Management
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Projects CRUD | Navigate to Projects | List, create, edit, delete work | ☐ |
| Videos CRUD | Navigate to Videos | List, create, edit, delete work | ☐ |
| Publications CRUD | Navigate to Publications | List, create, edit, delete work | ☐ |
| Music CRUD | Navigate to Music | List, create, edit, delete work | ☐ |
| Lead Magnets CRUD | Navigate to Lead Magnets | List, create, edit, delete work | ☐ |
| Prototypes CRUD | Navigate to Prototypes | List, create, edit, delete work | ☐ |
| Products CRUD | Navigate to Products | List, create, edit, delete work | ☐ |

### 8.4 Analytics Page
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Analytics loads | Navigate to Analytics | Charts and data display | ☐ |
| Date range filter | Change date range | Data updates | ☐ |
| Export data | Click export | Data downloads | ☐ |

### 8.5 User Management
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Users list | Navigate to Users | User list displays | ☐ |
| User details | Click user | User info shown | ☐ |

---

## 9. Responsive Design

Test at these breakpoints:
- Mobile: 375px width
- Tablet: 768px width
- Desktop: 1440px width

### 9.1 Mobile Tests (375px)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Navigation | View nav | Hamburger visible, logo scaled | ☐ |
| Hero | View hero | Content stacks vertically | ☐ |
| Cards | View any card section | Single column layout | ☐ |
| Cart | Open cart | Full width sidebar | ☐ |
| Forms | View any form | Inputs full width | ☐ |
| Touch targets | Tap buttons | 44px+ tap targets | ☐ |

### 9.2 Tablet Tests (768px)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Grid layouts | View card sections | 2-column grids | ☐ |
| Navigation | View nav | Still uses hamburger | ☐ |

### 9.3 Desktop Tests (1440px)
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Full layouts | View all sections | 3-column grids where appropriate | ☐ |
| Max widths | Check containers | Content doesn't stretch too wide | ☐ |

---

## 10. Performance & Error Handling

### 10.1 Performance
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| Initial load | Load homepage cold | < 3s to interactive | ☐ |
| Images load | Scroll through site | Images load progressively | ☐ |
| Animations smooth | Observe animations | No jank, 60fps | ☐ |

### 10.2 Error Handling
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| 404 page | Visit `/nonexistent` | 404 page displays | ☐ |
| API errors | Disconnect network, submit form | Error message shown | ☐ |
| Console errors | Browse entire site | No JavaScript errors | ☐ |

---

## 11. Chat Diagnostic API Tests

### 11.1 Diagnostic Endpoints
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| GET diagnostic by session | `GET /api/chat/diagnostic?sessionId=xxx` | Returns diagnostic audit if exists | ☐ |
| GET diagnostic by audit ID | `GET /api/chat/diagnostic?auditId=xxx` | Returns specific audit | ☐ |
| GET returns null if none | `GET /api/chat/diagnostic?sessionId=new` | Returns `{ audit: null }` | ☐ |
| PUT updates diagnostic | `PUT /api/chat/diagnostic` with auditId | Updates audit record | ☐ |
| PUT validates auditId | `PUT /api/chat/diagnostic` without auditId | Returns 400 error | ☐ |

### 11.2 Chat API with Diagnostic Mode
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| POST with diagnosticMode flag | Send message with `diagnosticMode: true` | Routes to diagnostic workflow | ☐ |
| POST detects diagnostic intent | Send "I want an audit" | Auto-detects and enables diagnostic mode | ☐ |
| POST saves diagnostic data | Send diagnostic responses | Data saved incrementally | ☐ |
| POST returns diagnostic metadata | Complete diagnostic step | Returns progress, category, completion status | ☐ |
| POST links to contact on completion | Complete diagnostic with email | Creates/updates contact_submission | ☐ |

### 11.3 Diagnostic Data Structure
| Test | Steps | Expected Result | Status |
|------|-------|-----------------|--------|
| All categories present | Complete diagnostic | All 6 categories have data | ☐ |
| Business challenges saved | Answer business questions | Data in `business_challenges` field | ☐ |
| Tech stack saved | Answer tech questions | Data in `tech_stack` field | ☐ |
| Automation needs saved | Answer automation questions | Data in `automation_needs` field | ☐ |
| AI readiness saved | Answer AI questions | Data in `ai_readiness` field | ☐ |
| Budget timeline saved | Answer budget questions | Data in `budget_timeline` field | ☐ |
| Decision making saved | Answer decision questions | Data in `decision_making` field | ☐ |
| Summary generated | Complete diagnostic | `diagnostic_summary` populated | ☐ |
| Insights extracted | Complete diagnostic | `key_insights` array populated | ☐ |
| Scores calculated | Complete diagnostic | `urgency_score` and `opportunity_score` set | ☐ |

## 12. API Endpoints Quick Check

Use browser dev tools Network tab or curl to verify:

### 12.1 Public Endpoints
```bash
# Products
curl http://localhost:3000/api/products?active=true

# Prototypes
curl http://localhost:3000/api/prototypes

# Publications
curl http://localhost:3000/api/publications

# Videos
curl http://localhost:3000/api/videos

# Music
curl http://localhost:3000/api/music

# Projects
curl http://localhost:3000/api/projects
```

### 11.2 Auth-Required Endpoints
```bash
# Cart (requires session)
curl http://localhost:3000/api/cart

# Orders (requires auth)
curl http://localhost:3000/api/orders

# User profile
curl http://localhost:3000/api/user/profile
```

### 12.3 Admin Endpoints
```bash
# Analytics (admin only)
curl http://localhost:3000/api/analytics/stats

# Users list (admin only)
curl http://localhost:3000/api/admin/users
```

---

## 13. Post-Test Cleanup

After testing:
- [ ] Clear test orders from database (if using real Stripe test mode)
- [ ] Reset any modified content
- [ ] Clear browser localStorage/sessionStorage
- [ ] Log out of all test accounts

---

## Test Results Log

| Date | Tester | Version/Commit | Passed | Failed | Notes |
|------|--------|----------------|--------|--------|-------|
| YYYY-MM-DD | Name | abc1234 | X/75 | X | Notes |

---

## Known Issues / Limitations

Document any known issues here:

1. _Example: OAuth redirect may fail in incognito mode_
2. _Example: Chat history doesn't sync across devices_
3. _Diagnostic: Requires n8n workflow to be configured for full functionality_
4. _Diagnostic: Diagnostic mode persists until explicitly exited or chat cleared_

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-21 | Initial test plan |
| 1.1 | 2026-01-29 | Added Chat Diagnostic Feature tests (12 new tests) |

---

## Quick Smoke Test (5 minutes)

For rapid verification after deployment, run these critical tests only:

1. [ ] Homepage loads with all sections
2. [ ] Navigation links work
3. [ ] Login/logout works
4. [ ] Products display in Store
5. [ ] Add to cart works
6. [ ] Contact form submits
7. [ ] Chat opens and sends messages
8. [ ] Diagnostic can be triggered via suggestion button
9. [ ] Admin dashboard loads (as admin)
10. [ ] No console errors on main pages

If any smoke test fails, run full test suite before proceeding.

## Diagnostic Feature Test Scenarios

### Scenario 1: Happy Path - Complete Diagnostic via Suggestion Button
1. [ ] Open chat component
2. [ ] Verify "Things you can ask me" suggestions appear
3. [ ] Click "Perform an AI Audit" button
4. [ ] Verify diagnostic mode activates (header changes, progress indicator shows)
5. [ ] Answer questions for each category (6 categories total)
6. [ ] Verify progress updates after each category
7. [ ] Complete all categories
8. [ ] Verify diagnostic status changes to "completed"
9. [ ] Verify diagnostic data saved to database
10. [ ] If email provided, verify linked to contact_submissions
11. [ ] Verify lead qualification webhook triggered

### Scenario 2: Diagnostic via Text Trigger
1. [ ] Open chat component
2. [ ] Type "I want to perform an AI audit"
3. [ ] Verify diagnostic mode activates automatically
4. [ ] Verify diagnostic audit record created
5. [ ] Answer questions and verify data saves incrementally

### Scenario 3: Diagnostic Persistence
1. [ ] Start diagnostic (answer 2-3 questions)
2. [ ] Refresh the page
3. [ ] Verify diagnostic state restored
4. [ ] Verify progress indicator shows correct category
5. [ ] Continue answering questions
6. [ ] Verify previous answers preserved

### Scenario 4: Exit Diagnostic Mode
1. [ ] Start diagnostic
2. [ ] Type "exit" or clear chat
3. [ ] Verify diagnostic mode ends
4. [ ] Verify can return to normal chat
5. [ ] Verify diagnostic audit status set to "abandoned" or remains "in_progress"

### Scenario 5: Diagnostic with Contact Linking
1. [ ] Start diagnostic with visitor email provided
2. [ ] Complete diagnostic
3. [ ] Verify diagnostic_audits.contact_submission_id populated
4. [ ] Verify contact_submissions record created/updated
5. [ ] Verify lead qualification webhook includes diagnostic insights
6. [ ] Check database for diagnostic data in contact_submissions fields

### Scenario 6: Multiple Diagnostic Triggers
Test that various phrases trigger diagnostic:
- [ ] "perform an audit"
- [ ] "I need a diagnostic"
- [ ] "help me identify issues"
- [ ] "business assessment"
- [ ] "analyze my business"
- [ ] "evaluate my tech stack"
- [ ] "review my automation needs"

Each should activate diagnostic mode.

### Scenario 7: Diagnostic API Endpoints
1. [ ] Start diagnostic, get auditId
2. [ ] `GET /api/chat/diagnostic?sessionId=xxx` returns audit
3. [ ] `GET /api/chat/diagnostic?auditId=xxx` returns same audit
4. [ ] `PUT /api/chat/diagnostic` updates audit status
5. [ ] Verify all diagnostic fields accessible via API

### Scenario 8: Error Handling
1. [ ] Start diagnostic without n8n configured
2. [ ] Verify graceful fallback to regular chat
3. [ ] Start diagnostic, disconnect network mid-way
4. [ ] Verify error message shown
5. [ ] Verify diagnostic progress not lost
6. [ ] Reconnect and continue
7. [ ] Verify can complete diagnostic
