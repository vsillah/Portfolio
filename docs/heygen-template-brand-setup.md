# HeyGen Template API + AmaduTown Brand Setup

Use the Template API with Brand Glossary for AmaduTown-branded videos (pronunciation, terminology, tone).

## 1. Create AmaduTown Template in HeyGen

1. In HeyGen Studio, create a new template.
2. Add your avatar, layout, and a **text variable** for the script (e.g. `{{script}}`).
3. Apply your Brand System (logos, colors, fonts) in the template.
4. Save and note the **Template ID** (from URL or API).

## 2. Create AmaduTown Brand Glossary

1. HeyGen → Brand Glossary (or Brand Voice).
2. Create a new glossary, e.g. "AmaduTown".
3. Configure:
   - **Blacklist** (never translate/change): `AmaduTown`, `Mad Hadda`, `Vambah Sillah`
   - **Vocabulary** (pronunciations): e.g. `[AmaduTown, ah-MAH-doo-town]` if needed
   - **Tone**: `Conversational, mission-driven, no-BS` (from `lib/constants/creator-background.ts`)
4. Save and note the **Brand Voice ID** (from API or list).

## 3. Environment Variables

Add to `.env.local`:

```env
# Template mode (AmaduTown branding)
HEYGEN_TEMPLATE_ID=your_template_id
HEYGEN_BRAND_VOICE_ID=your_brand_voice_id

# Fallback: avatar mode (when template not set)
HEYGEN_AVATAR_ID=your_avatar_id
HEYGEN_VOICE_ID=your_voice_id
```

## 4. Template Variable Name

The default script variable is `script`. If your template uses a different placeholder (e.g. `{{narration}}`), set `scriptVariableName` when calling the API.

## 5. Admin UI

Admin → Content → Video Generation:

- **Mode:** Template (AmaduTown Brand) vs Avatar
- **Template:** Select from list or use env default
- **Brand Voice:** Select from list or use env default

Generate video, Ideas Queue, and Drive Queue all use the selected mode.
