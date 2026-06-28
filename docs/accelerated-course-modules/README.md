# Accelerated Course Module Production Package

This package turns *Accelerated: Building Smarter Products with AI* into a flagship mini-course with eight review-ready module packets.

The course is built from the existing 60-minute workshop spine, but each module is shaped for self-paced video learning. Every module includes:

- a lesson outcome,
- a book-spine mapping,
- an AmaduTown or Portfolio proof cue,
- a primary lesson script draft,
- a YouTube Shorts cutdown,
- b-roll and storyboard direction,
- thumbnail concepts,
- a worksheet prompt,
- and a privacy/review gate.

## Production Stack

- HeyGen: avatar/presenter segments for intro, transition, and close.
- ElevenLabs: alternate narration for framework-heavy or slide-first lessons.
- Remotion / HyperFrames: final lesson composition, captions, title cards, proof clips, and exports.
- Portfolio b-roll capture: public AmaduTown pages and sanitized admin proof moments.

Provider execution is locked until separately approved. These files prepare review packets only; they do not call HeyGen, ElevenLabs, Remotion, HyperFrames, n8n, upload, schedule, or publish.

## Files

- `module-production-packets.md` - the eight module packets.
- `broll-capture-list.md` - reusable capture list and privacy rules.
- `source-register.md` - source, voice, and safety provenance.
- `review-status.json` - machine-checkable review status per module.

## Validation

Run:

```bash
npx tsx scripts/validate-accelerated-course-modules.ts
```

The validator checks that all eight modules are present, each has chapter mapping, proof cue, practical exercise, video packet fields, thumbnail direction, and the provider safety boundary.
