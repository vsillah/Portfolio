# n8n Diagnostic Workflow Setup Guide

This guide explains how to add diagnostic routing and workflow logic to your existing n8n chat workflow.

## Overview

When a user requests an AI audit/diagnostic, the application sends a payload with `diagnosticMode: true`. Your n8n workflow needs to:
1. **Detect** the diagnostic mode flag
2. **Route** to a diagnostic-specific workflow branch
3. **Guide** the user through structured questions across 6 categories
4. **Return** structured diagnostic data for storage

## Current Payload Structure

When diagnostic mode is triggered, n8n receives:

```json
{
  "action": "sendMessage",
  "sessionId": "chat_abc123_xyz789",
  "chatInput": "I want to perform an AI audit",
  "diagnosticMode": true,
  "diagnosticAuditId": "uuid-here",
  "currentCategory": "business_challenges",  // or null if starting
  "progress": {
    "completedCategories": ["business_challenges"],
    "questionsAsked": ["What are your main business challenges?"],
    "responsesReceived": {
      "business_challenges": {
        "pain_points": ["Manual processes", "Lack of automation"]
      }
    }
  },
  "visitorEmail": "user@example.com",
  "visitorName": "John Doe"
}
```

## n8n Workflow Structure

### Option 1: Add Diagnostic Branch to Existing Workflow (Recommended)

Modify your existing chat workflow to add diagnostic routing:

```
[Webhook Trigger]
    ↓
[IF Node: Check diagnosticMode]
    ├─ TRUE → [Diagnostic Workflow Branch]
    └─ FALSE → [Regular Chat Branch]
```

#### Step-by-Step Setup:

**1. Add IF Node After Webhook**

Add an **IF** node right after your webhook trigger:

- **Condition**: Check if `diagnosticMode` exists and is `true`
- **Mode**: Rules
- **Rule**: `{{ $json.diagnosticMode }}` equals `true`

**2. Create Diagnostic Workflow Branch (TRUE path)**

The diagnostic branch should:

1. **Check Current Category** (IF node)
   - If `currentCategory` is null/empty → Start with first category
   - If `currentCategory` exists → Continue that category
   - If all categories complete → Generate summary

2. **Category Flow** (Switch node or nested IF)
   - Route based on `currentCategory`:
     - `business_challenges` → Business questions
     - `tech_stack` → Tech questions
     - `automation_needs` → Automation questions
     - `ai_readiness` → AI readiness questions
     - `budget_timeline` → Budget/timeline questions
     - `decision_making` → Decision-making questions

3. **AI Agent Node** (for each category)
   - Use **AI Agent** or **OpenAI Chat Model** node
   - System prompt should guide the conversation for that specific category
   - Use **Simple Memory** node to maintain conversation state per sessionId

4. **Extract Response Data** (Code/Function node)
   - Parse the user's response
   - Extract structured data for the current category
   - Update progress tracking

5. **Determine Next Step** (IF node)
   - If category complete → Move to next category
   - If all categories complete → Generate summary
   - Otherwise → Ask next question in current category

6. **Format Response** (Set node)
   - Return structured response with diagnostic data

**3. Response Format**

The diagnostic workflow must return JSON in this format:

```json
{
  "response": "What are your main business challenges?",
  "diagnosticData": {
    "business_challenges": {
      "pain_points": ["Manual processes"],
      "inefficiencies": ["Time-consuming tasks"]
    }
  },
  "currentCategory": "business_challenges",
  "isComplete": false,
  "nextQuestion": "What processes take up most of your team's time?",
  "progress": {
    "completedCategories": [],
    "questionsAsked": ["What are your main business challenges?"],
    "responsesReceived": {
      "business_challenges": {
        "pain_points": ["Manual processes"]
      }
    }
  },
  "metadata": {
    "categoryProgress": 1,
    "totalCategories": 6
  }
}
```

When diagnostic is complete:

```json
{
  "response": "Thank you for completing the diagnostic! Based on your responses, here are the key insights...",
  "diagnosticData": {
    "business_challenges": { /* all data */ },
    "tech_stack": { /* all data */ },
    "automation_needs": { /* all data */ },
    "ai_readiness": { /* all data */ },
    "budget_timeline": { /* all data */ },
    "decision_making": { /* all data */ },
    "diagnostic_summary": "Summary of findings...",
    "key_insights": ["Insight 1", "Insight 2"],
    "recommended_actions": ["Action 1", "Action 2"],
    "urgency_score": 8,
    "opportunity_score": 7
  },
  "currentCategory": null,
  "isComplete": true,
  "progress": {
    "completedCategories": ["business_challenges", "tech_stack", "automation_needs", "ai_readiness", "budget_timeline", "decision_making"],
    "questionsAsked": [/* all questions */],
    "responsesReceived": { /* all responses */ }
  }
}
```

## Diagnostic Category Prompts

### Business Challenges Category

**System Prompt:**
```
You are conducting a business diagnostic assessment. Your goal is to identify the user's main business challenges, pain points, and inefficiencies.

Ask questions to understand:
- What manual processes slow them down?
- What inefficiencies exist in their workflows?
- What growth blockers are they facing?
- What keeps them up at night?

Ask ONE question at a time. Be conversational and empathetic. After each response, extract:
- pain_points: Array of pain points mentioned
- inefficiencies: Array of inefficiencies identified
- growth_blockers: Array of blockers mentioned

When you have enough information (3-5 questions), move to the next category.
```

### Tech Stack Category

**System Prompt:**
```
You are assessing the user's current technology stack and identifying gaps.

Ask questions about:
- What tools and software they currently use
- What integrations they need
- What technology gaps exist
- What tools they're missing

Extract:
- current_tools: Array of tools they use
- integration_needs: Array of integration requirements
- gaps: Array of technology gaps
- missing_tools: Array of tools they need
```

### Automation Needs Category

**System Prompt:**
```
You are identifying automation opportunities for the user.

Ask about:
- What manual processes could be automated
- What repetitive tasks consume time
- What workflow bottlenecks exist
- What automation opportunities they see

Extract:
- manual_processes: Array of manual processes
- repetitive_tasks: Array of repetitive tasks
- bottlenecks: Array of workflow bottlenecks
- automation_opportunities: Array of automation opportunities
```

### AI Readiness Category

**System Prompt:**
```
You are assessing the user's AI readiness and opportunities.

Ask about:
- Current AI usage in their business
- AI opportunities they see
- Concerns or barriers to AI adoption
- AI use cases relevant to their business

Extract:
- current_ai_usage: Description of current AI usage
- opportunities: Array of AI opportunities
- concerns: Array of concerns/barriers
- use_cases: Array of relevant AI use cases
- readiness_level: Score 1-10
```

### Budget/Timeline Category

**System Prompt:**
```
You are understanding the user's budget constraints and timeline.

Ask about:
- Budget range for solutions
- Timeline for implementation
- Urgency of their needs
- Decision timeline

Extract:
- budget_range: Budget range (e.g., "10k-50k", "under 10k")
- timeline: Implementation timeline
- urgency: Urgency level (1-10)
- decision_timeline: When they need to decide
```

### Decision Making Category

**System Prompt:**
```
You are understanding the user's decision-making process.

Ask about:
- Who are the key stakeholders
- What is the approval process
- Who makes the final decision
- What buying signals exist

Extract:
- stakeholders: Array of key stakeholders
- approval_process: Description of approval process
- decision_maker: Name/role of decision maker
- buying_signals: Array of buying signals
```

## Example n8n Workflow Structure

```
[Webhook Trigger]
    ↓
[IF: diagnosticMode === true?]
    ├─ TRUE:
    │   ├─ [IF: currentCategory === null?]
    │   │   ├─ TRUE: [Set currentCategory = "business_challenges"]
    │   │   └─ FALSE: [Continue with currentCategory]
    │   ├─ [Switch: currentCategory]
    │   │   ├─ business_challenges → [AI Agent: Business Prompt]
    │   │   ├─ tech_stack → [AI Agent: Tech Prompt]
    │   │   ├─ automation_needs → [AI Agent: Automation Prompt]
    │   │   ├─ ai_readiness → [AI Agent: AI Readiness Prompt]
    │   │   ├─ budget_timeline → [AI Agent: Budget Prompt]
    │   │   └─ decision_making → [AI Agent: Decision Prompt]
    │   ├─ [Extract Response Data]
    │   ├─ [IF: Category Complete?]
    │   │   ├─ TRUE: [Move to Next Category]
    │   │   └─ FALSE: [Ask Next Question]
    │   ├─ [IF: All Categories Complete?]
    │   │   ├─ TRUE: [Generate Summary & Insights]
    │   │   └─ FALSE: [Continue]
    │   └─ [Format Diagnostic Response]
    │
    └─ FALSE:
        └─ [Regular Chat Flow]
            └─ [AI Agent: General Chat]
```

## Using Simple Memory for State

Use n8n's **Simple Memory** node to maintain conversation state:

1. Add **Simple Memory** node before your AI Agent
2. Configure:
   - **Session ID**: `{{ $json.sessionId }}`
   - **Memory Type**: Chat History
3. Connect AI Agent's memory input to Simple Memory output

This ensures the AI remembers previous questions and responses within the diagnostic session.

## Testing the Diagnostic Workflow

1. **Test Diagnostic Detection**
   - Send payload with `diagnosticMode: true`
   - Verify workflow routes to diagnostic branch

2. **Test Category Progression**
   - Start with `currentCategory: null`
   - Verify first category starts
   - Complete a category, verify next category starts

3. **Test Data Extraction**
   - Send responses for each category
   - Verify `diagnosticData` is populated correctly

4. **Test Completion**
   - Complete all 6 categories
   - Verify `isComplete: true`
   - Verify summary and insights are generated

## Troubleshooting

### Diagnostic mode not detected
- Check IF node condition: `{{ $json.diagnosticMode }}` equals `true`
- Verify payload includes `diagnosticMode: true`

### Category not progressing
- Check `currentCategory` is being updated in response
- Verify category completion logic

### Data not extracting
- Check AI Agent prompts include extraction instructions
- Verify Code/Function node parses responses correctly

### Response format incorrect
- Ensure Set node formats response as JSON
- Verify all required fields are included

## Alternative: Separate Diagnostic Workflow

If you prefer a completely separate workflow:

1. Create new workflow: "Chat Diagnostic"
2. Use same webhook path or different path
3. Set `N8N_DIAGNOSTIC_WEBHOOK_URL` environment variable to point to this workflow
4. This workflow only handles diagnostic mode (no routing needed)

## Next Steps

1. Add IF node to detect `diagnosticMode` in your existing workflow
2. Create diagnostic branch with category routing
3. Add AI Agent nodes with category-specific prompts
4. Add data extraction logic
5. Format responses according to schema above
6. Test with diagnostic requests
7. Monitor logs to ensure proper routing

## Reference: Expected Response Schema

See `lib/n8n.ts` for TypeScript types:
- `DiagnosticResponse` interface
- `DiagnosticAuditData` interface
- `DiagnosticProgress` interface

These types define the exact structure your n8n workflow should return.
