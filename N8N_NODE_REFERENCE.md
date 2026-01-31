# n8n Node Reference for Diagnostic Workflow

This guide maps each step of the diagnostic workflow to specific n8n nodes with configuration details.

## Node Types Overview

| Operation | n8n Node Type | Purpose |
|-----------|---------------|---------|
| Set/Update Values | **Set** | Set `currentCategory`, update progress, format responses |
| Conditional Logic | **IF** | Check if diagnostic mode, check category status |
| Route by Value | **Switch** | Route to different categories based on `currentCategory` |
| AI Processing | **AI Agent** or **OpenAI Chat Model** | Process user messages, ask questions |
| State Management | **Simple Memory** | Maintain conversation history per session |
| Data Extraction | **Code** or **Function** | Parse responses, extract structured data |
| Response Formatting | **Set** | Format final JSON response |

## Step-by-Step Node Configuration

### Step 1: Detect Diagnostic Mode

**Node Type:** **IF**

**Configuration:**
- **Mode:** Rules
- **Rule 1:**
  - **Value 1:** `{{ $json.diagnosticMode }}`
  - **Operation:** equals
  - **Value 2:** `true`
- **Output:** TRUE → Diagnostic branch, FALSE → Regular chat

**Why:** The IF node checks if `diagnosticMode` is true in the incoming payload.

---

### Step 2: Initialize or Check Current Category

**Node Type:** **IF** (to check if starting)

**Configuration:**
- **Mode:** Rules
- **Rule 1:**
  - **Value 1:** `{{ $json.currentCategory }}`
  - **Operation:** is empty
  - **Value 2:** (leave empty)
- **Output:** TRUE → Initialize first category, FALSE → Continue existing category

**Why:** Determines if this is the first diagnostic question or a continuation.

---

### Step 3: Set Current Category (When Starting)

**Node Type:** **Set**

**Configuration:**
- **Mode:** Manual
- **Keep Only Set Fields:** OFF (to preserve other data)
- **Fields to Set:**
  - **Name:** `currentCategory`
  - **Value:** `business_challenges`
  - **Type:** String

**Why:** Sets the first category when diagnostic starts. The Set node allows you to add/update fields in the data flow.

**Alternative:** You can also set this in a Code node:
```javascript
return {
  json: {
    ...$input.all()[0].json,
    currentCategory: 'business_challenges'
  }
};
```

---

### Step 4: Route by Category

**Node Type:** **Switch**

**Configuration:**
- **Mode:** Rules
- **Rules:**
  1. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `business_challenges`
  2. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `tech_stack`
  3. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `automation_needs`
  4. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `ai_readiness`
  5. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `budget_timeline`
  6. **Value:** `{{ $json.currentCategory }}`
     - **Operation:** equals
     - **Value:** `decision_making`

**Why:** Routes to the appropriate AI Agent based on the current category. Each output connects to a different category handler.

---

### Step 5: Process Category Questions (AI Agent)

**Node Type:** **AI Agent** (recommended) or **OpenAI Chat Model**

**Configuration for AI Agent:**
- **Chat Model:** Your preferred model (GPT-4, Claude, etc.)
- **System Message:** Category-specific prompt (see prompts in N8N_DIAGNOSTIC_SETUP.md)
- **Chat Input:** `{{ $json.chatInput }}`
- **Session ID:** `{{ $json.sessionId }}`
- **Memory:** Connect to Simple Memory node output

**Configuration for OpenAI Chat Model:**
- **Model:** gpt-4 or gpt-3.5-turbo
- **Messages:**
  - **System:** Category-specific prompt
  - **User:** `{{ $json.chatInput }}`
- **Options:**
  - **Temperature:** 0.7
  - **Max Tokens:** 500

**Why:** Processes the user's response and generates the next question for the current category.

---

### Step 6: Extract Structured Data from Response

**Node Type:** **Code** or **Function**

**Configuration (Code node):**
```javascript
// Get the AI response
const aiResponse = $input.item.json.output || $input.item.json.text || $input.item.json.message;
const currentCategory = $input.item.json.currentCategory;
const progress = $input.item.json.progress || {};

// Extract structured data (you can use AI to parse this, or use regex/string parsing)
// For now, we'll store the raw response and let the AI Agent handle extraction
const extractedData = {
  response_text: aiResponse,
  category: currentCategory
};

// Update progress
const updatedProgress = {
  ...progress,
  questionsAsked: [...(progress.questionsAsked || []), "Question asked"],
  responsesReceived: {
    ...(progress.responsesReceived || {}),
    [currentCategory]: {
      ...(progress.responsesReceived?.[currentCategory] || {}),
      latest_response: aiResponse
    }
  }
};

return {
  json: {
    ...$input.item.json,
    extractedData,
    progress: updatedProgress
  }
};
```

**Why:** Extracts structured data from the AI's response and updates progress tracking.

---

### Step 7: Determine if Category is Complete

**Node Type:** **IF**

**Configuration:**
- **Mode:** Rules
- **Rule 1:**
  - **Value 1:** `{{ $json.extractedData.category_complete }}` (set by AI Agent or Code node)
  - **Operation:** equals
  - **Value 2:** `true`
- **Output:** TRUE → Move to next category, FALSE → Ask next question in same category

**Alternative:** Check question count
- **Value 1:** `{{ $json.progress.questionsAsked.length }}`
  - **Operation:** is greater than
  - **Value 2:** `3` (or your threshold)

**Why:** Determines whether to move to the next category or continue with the current one.

---

### Step 8: Move to Next Category

**Node Type:** **Set**

**Configuration:**
- **Mode:** Manual
- **Keep Only Set Fields:** OFF
- **Fields to Set:**
  - **Name:** `currentCategory`
  - **Value:** Use Code node to determine next category:
    ```javascript
    const categories = [
      'business_challenges',
      'tech_stack',
      'automation_needs',
      'ai_readiness',
      'budget_timeline',
      'decision_making'
    ];
    const current = $input.item.json.currentCategory;
    const currentIndex = categories.indexOf(current);
    const nextCategory = currentIndex < categories.length - 1 
      ? categories[currentIndex + 1] 
      : null; // All categories complete
    
    return {
      json: {
        ...$input.item.json,
        currentCategory: nextCategory,
        completedCategories: [
          ...($input.item.json.completedCategories || []),
          current
        ]
      }
    };
    ```

**Why:** Advances to the next category in the sequence.

---

### Step 9: Check if All Categories Complete

**Node Type:** **IF**

**Configuration:**
- **Mode:** Rules
- **Rule 1:**
  - **Value 1:** `{{ $json.currentCategory }}`
  - **Operation:** is empty
  - **Value 2:** (leave empty)
- **Output:** TRUE → Generate summary, FALSE → Continue with next category

**Why:** Determines if the diagnostic is complete and ready for summary generation.

---

### Step 10: Generate Diagnostic Summary

**Node Type:** **AI Agent** or **OpenAI Chat Model**

**Configuration:**
- **System Message:**
```
You are generating a diagnostic summary. Review all the collected data across all 6 categories and create:
1. A comprehensive summary of findings
2. Key insights (3-5 bullet points)
3. Recommended actions (3-5 actionable items)
4. Urgency score (1-10)
5. Opportunity score (1-10)

Return your response as JSON with these fields.
```

- **Chat Input:** `{{ JSON.stringify($json.progress.responsesReceived) }}`

**Why:** Generates the final summary, insights, and scores from all collected diagnostic data.

---

### Step 11: Format Final Response

**Node Type:** **Set**

**Configuration:**
- **Mode:** Manual
- **Keep Only Set Fields:** ON (to return only the response structure)
- **Fields to Set:**
  - **Name:** `response`
  - **Value:** `{{ $json.summary_response }}`
  - **Type:** String
  
  - **Name:** `diagnosticData`
  - **Value:** `{{ $json.progress.responsesReceived }}`
  - **Type:** Object
  
  - **Name:** `currentCategory`
  - **Value:** `null` (or empty)
  - **Type:** String
  
  - **Name:** `isComplete`
  - **Value:** `true`
  - **Type:** Boolean
  
  - **Name:** `progress`
  - **Value:** `{{ $json.progress }}`
  - **Type:** Object

**Why:** Formats the response to match the expected JSON schema that your application expects.

---

## Complete Workflow Structure with Node Types

```
[Webhook Trigger]
    ↓
[IF Node: diagnosticMode === true?]
    ├─ TRUE:
    │   ├─ [IF Node: currentCategory is empty?]
    │   │   ├─ TRUE: [Set Node: currentCategory = "business_challenges"]
    │   │   └─ FALSE: [Continue]
    │   ├─ [Switch Node: Route by currentCategory]
    │   │   ├─ business_challenges → [AI Agent: Business Prompt]
    │   │   ├─ tech_stack → [AI Agent: Tech Prompt]
    │   │   ├─ automation_needs → [AI Agent: Automation Prompt]
    │   │   ├─ ai_readiness → [AI Agent: AI Readiness Prompt]
    │   │   ├─ budget_timeline → [AI Agent: Budget Prompt]
    │   │   └─ decision_making → [AI Agent: Decision Prompt]
    │   ├─ [Code Node: Extract Response Data]
    │   ├─ [IF Node: Category Complete?]
    │   │   ├─ TRUE: [Set Node: Move to Next Category]
    │   │   └─ FALSE: [Set Node: Format Question Response]
    │   ├─ [IF Node: All Categories Complete?]
    │   │   ├─ TRUE: [AI Agent: Generate Summary]
    │   │   └─ FALSE: [Continue]
    │   └─ [Set Node: Format Final Response]
    │
    └─ FALSE:
        └─ [Regular Chat Flow]
```

## Key Points for Setting currentCategory

1. **Use Set Node** to set `currentCategory` initially:
   - When diagnostic starts: Set to `"business_challenges"`
   - When moving to next category: Update to next category name

2. **Use Code Node** for complex logic:
   - To determine next category programmatically
   - To check if all categories are complete
   - To update progress arrays

3. **Use IF Node** to check `currentCategory`:
   - Check if it's empty (starting)
   - Check if it's null (complete)
   - Check specific category values

4. **Use Switch Node** to route by `currentCategory`:
   - Route to different AI Agent nodes based on category value
   - Each output handles one category

## Example: Setting currentCategory in Set Node

**Node:** Set
**Mode:** Manual
**Fields:**
```
Name: currentCategory
Value: business_challenges
Type: String
```

To update it later:
```
Name: currentCategory  
Value: tech_stack
Type: String
```

## Example: Checking currentCategory in IF Node

**Node:** IF
**Mode:** Rules
**Rule:**
```
Value 1: {{ $json.currentCategory }}
Operation: equals
Value 2: business_challenges
```

## Example: Routing by currentCategory in Switch Node

**Node:** Switch
**Mode:** Rules
**Rules:**
1. `{{ $json.currentCategory }}` equals `business_challenges`
2. `{{ $json.currentCategory }}` equals `tech_stack`
3. `{{ $json.currentCategory }}` equals `automation_needs`
... (and so on for all 6 categories)

## State Management Tips

1. **Preserve Data:** When using Set node, keep "Keep Only Set Fields" OFF to preserve other fields
2. **Use Code Node:** For complex state updates (arrays, nested objects)
3. **Simple Memory:** Use for conversation history, not for category state (category state comes from your app)
4. **Progress Tracking:** Store in `progress` object, update with Code or Set nodes

## Common Mistakes to Avoid

1. **Don't use Simple Memory for currentCategory** - It's for chat history, not workflow state
2. **Don't forget to preserve data** - Use "Keep Only Set Fields: OFF" when updating
3. **Don't hardcode category names** - Use the values from `$json.currentCategory`
4. **Don't lose progress data** - Always merge with existing progress object
