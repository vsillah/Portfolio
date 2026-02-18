# Install Guide — Eval Template

## Prerequisites

- Node.js 18+
- Supabase project
- Anthropic and/or OpenAI API key (for LLM-as-Judge)

## 1. Clone or copy

```bash
cp -r eval-template /path/to/your-project
cd /path/to/your-project
```

## 2. Install dependencies

```bash
npm install
```

## 3. Database

Run the SQL in `database/` in Supabase (eval runs, categories, human/LLM annotations).

## 4. Environment variables

Copy `.env.example` to `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` for the LLM judge

## 5. Configure evaluation criteria

- Edit the LLM judge prompt and criteria in `lib/llm-judge.ts` (or equivalent).
- Adjust categories in the database or config to match your chat/product.

## 6. Run

```bash
npm run dev
```

Use the annotation UI to label conversations and run automated evaluations.

## 7. Deploy

Deploy to your host; add API keys to env. Restrict eval routes to admin or internal use if needed.
