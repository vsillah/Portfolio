# Custom Prompt for Video Ideas Generation

## What Exists

The Video Generation page already has a **Generate Video Ideas** section that:
- Calls `POST /api/admin/video-generation/generate-ideas`
- Fetches portfolio context (meetings, chat sessions, social content, creator background, website knowledge)
- Sends context to GPT-4o → returns script + storyboard (with `brollHint` per scene)
- Optionally adds ideas to `video_ideas_queue`
- Ideas queue items can be Generated (B-roll + HeyGen) from the admin UI

**What's missing:** There is no field for a **custom prompt** to steer the LLM. Ideas are generated entirely from DB context, so you cannot inject a topic, customer conversation, or ad-hoc thought.

---

## Changes

### 1. API: accept optional `customPrompt` in generate-ideas

**File:** [app/api/admin/video-generation/generate-ideas/route.ts](app/api/admin/video-generation/generate-ideas/route.ts)

- Add `body.customPrompt` (optional string)
- If provided, prepend it to the user prompt so the LLM focuses on that topic/direction while still having portfolio context
- Example user prompt becomes:

```
The user has this specific direction for video ideas:
"{customPrompt}"

Based on the above direction AND the following context, generate {limit} video ideas...
```

### 2. UI: add custom prompt textarea

**File:** [app/admin/content/video-generation/page.tsx](app/admin/content/video-generation/page.tsx)

In the "Generate Video Ideas" section (~line 820), add a textarea above the "Generate Ideas" button:
- Label: "Topic or direction (optional)"
- Placeholder: "e.g. A conversation I had with a restaurant owner about automating their ordering..."
- State: `ideasCustomPrompt`
- Passed to the API as `customPrompt`

### 3. Store custom prompt on queue items (optional)

**File:** [migrations/2026_03_12_video_ideas_queue.sql](migrations/2026_03_12_video_ideas_queue.sql)

- If not already present, add `custom_prompt TEXT` to `video_ideas_queue` so the original direction is traceable
- Set it from `body.customPrompt` when inserting queue rows in the generate-ideas route

---

## Your Workflow After This Change

1. **Admin -> Video Generation -> Generate Video Ideas**
2. Type your topic/thought in the custom prompt field (or leave blank for automatic)
3. Click **Generate Ideas** -- LLM produces script + storyboard informed by your prompt + portfolio context
4. Review ideas in the queue, click **Generate** on the one you like
5. B-roll is captured, HeyGen avatar video is created
6. Watch the video when done, stitch B-roll in editor if needed
7. Publish manually (YouTube, LinkedIn, IG publishing is not yet built)

No Claude chat, no Drive, no context-switching. Everything stays in the portfolio.
