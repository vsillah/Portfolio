# Fixing n8n Webhook Empty Response Issue

**Quick fix:** In your chat workflow, add a **Respond to Webhook** node as the **last node**, set the Webhook trigger to **Response Mode: "Using Respond to Webhook Node"**, then return JSON with a `"response"` field. Details below.

## Problem
The n8n workflow at `https://n8n.amadutown.com/webhook/.../chat` is returning HTTP 200 OK but with an **empty response body**. This causes the chat/diagnostic flow to fail.

## Root Cause
The n8n workflow is receiving and processing requests, but is **not configured to return a response**. This typically happens when:
1. The workflow doesn't have a "Respond to Webhook" node
2. The "Respond to Webhook" node is not connected to the workflow
3. The workflow is using a regular Webhook (fire-and-forget) instead of a "Webhook" that waits for response

## Solution

### Step 1: Open your n8n workflow
Navigate to your chat workflow in n8n.

### Step 2: Add "Respond to Webhook" node
1. Find the "Respond to Webhook" node in the node palette
2. Add it to your workflow
3. Connect it as the **final node** in your workflow chain

### Step 3: Configure the response
The "Respond to Webhook" node should output JSON like this:

```json
{
  "response": "Your AI-generated response text here",
  "escalated": false,
  "metadata": {
    "intent": "detected_intent",
    "confidence": 0.95
  }
}
```

### For Diagnostic Mode
When `diagnosticMode: true` is received, the response should include:

```json
{
  "response": "The question to ask the user",
  "currentCategory": "business_challenges",
  "isComplete": false,
  "progress": {
    "completedCategories": ["business_challenges"],
    "currentCategory": "tech_stack"
  },
  "diagnosticData": null
}
```

When the diagnostic is complete:

```json
{
  "response": "Thank you for completing the assessment...",
  "isComplete": true,
  "diagnosticData": {
    "diagnostic_summary": "Summary of findings",
    "urgency_score": 7,
    "opportunity_score": 8,
    "recommended_services": ["ai_strategy", "automation"]
  }
}
```

### Step 4: Verify the webhook configuration
Ensure your Webhook node is set to:
- **HTTP Method**: POST
- **Response Mode**: "Using Respond to Webhook Node" (not "Immediately")

### Step 5: Test
1. Activate the workflow
2. Send a test request using curl:

```bash
curl -X POST https://n8n.amadutown.com/webhook/YOUR_WEBHOOK_PATH/chat \
  -H "Content-Type: application/json" \
  -d '{"action":"sendMessage","sessionId":"test123","chatInput":"Hello"}'
```

3. You should receive a JSON response (not empty)

## Temporary Workaround
While fixing the n8n workflow, you can enable mock mode by setting in `.env.local`:

```
MOCK_N8N=true
```

This bypasses n8n and returns mock responses, allowing development and testing to continue.

## Verification
After fixing the workflow, set `MOCK_N8N=false` (or remove it) and test again to ensure the real n8n integration works.
