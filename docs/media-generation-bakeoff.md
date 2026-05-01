# Image And Video Generation Bakeoff

Use this when Portfolio needs to choose a new image or video generation model without guessing from demos, hype, or one good output.

The goal is simple: run the same prompt packet through multiple providers, score the results, then install the winner behind a Portfolio adapter so the selected generator can change later without rebuilding the admin workflow.

## Starting Providers

| Provider | Role | Why it belongs in the bakeoff |
| --- | --- | --- |
| fal | Primary media playground and aggregator | Broad image, video, audio, and 3D model catalog; model pages include playgrounds, schemas, pricing, latency, and code examples. |
| Replicate | Broad API fallback | Useful hosted model catalog for open and partner models; good secondary comparison surface. |
| OpenRouter | Image routing specialist | Useful when image-capable models should sit beside text model routing. Treat as image-first unless required video generation APIs fit the workflow. |
| Direct provider | Specialist path | Use when a first-party provider has the best model, rights, controls, or reliability and the extra lock-in is justified. |

## Benchmark Packet

Freeze the packet before running tests:

- use case and target channel
- shared prompt text
- negative constraints
- reference assets
- required aspect ratios
- output count per prompt
- max latency
- max cost per accepted asset
- acceptance criteria

Run each provider at least three times per prompt. A single output can be lucky. A production choice needs a pattern.

## Scoring

Score each provider from 1 to 5 on the same dimensions:

| Dimension | Weight | What to check |
| --- | ---: | --- |
| Output quality | 22% | Visual quality, artifacts, realism or illustration quality, motion coherence for video. |
| Prompt and reference fidelity | 16% | Follows prompt, uses references, keeps composition and constraints. |
| Speed and throughput | 14% | p50 latency, p90 latency, queue behavior, batch behavior. |
| Cost control | 10% | Cost per run and cost per accepted output. |
| Brand and text control | 12% | Logo handling, type/text rendering, color discipline, character or product consistency. |
| Workflow fit | 10% | Fits Portfolio's image, video, social, b-roll, and admin review flows. |
| API installability | 8% | SDK/API maturity, schema clarity, auth path, local smoke test path. |
| Observability and provenance | 8% | Can save model id, prompt version, settings, latency, cost, output URLs, and reviewer notes. |

Promotion rule:

- weighted score of 4.0 or higher
- no privacy, rights, or safety blocker
- beats the current default on the highest-priority dimension
- stays inside latency and cost limits
- has a working server-side adapter smoke test
- keeps the old default as fallback for at least two successful production runs

## Portfolio Integration Shape

The app should not call each tool directly from the UI. Add a shared provider layer:

```ts
type MediaGenerationRequest = {
  mode: 'image' | 'image_edit' | 'text_to_video' | 'image_to_video' | 'avatar_video'
  prompt: string
  referenceAssetUrls?: string[]
  aspectRatio?: string
  modelId: string
  provider: 'fal' | 'replicate' | 'openrouter' | 'direct_provider'
}
```

The admin playground should:

- select a benchmark packet
- run installed providers side by side
- save output, cost, latency, status, and reviewer score
- rank models with the scoring engine in `lib/media-generation-bakeoff.ts`
- promote a selected provider/model into settings only after the gate passes

The production content tools should read the selected provider/model from settings, not from hard-coded UI state.

## Current Source Notes

- fal documentation says every model has a Playground for real inputs and code samples, and its model pages show pricing, average latency, schemas, and copyable code.
- fal's public site positions the platform as a library of 1000+ generative media models for image, video, voice, and code generation.
- OpenRouter documentation supports image generation through its chat completions and responses endpoints, with model discovery by `output_modalities=image`.
- Replicate documentation describes running models through a web playground or API; use model-level license and pricing checks before promotion.

These sources change quickly. Refresh the provider shortlist before a serious bakeoff, especially for new video models.
