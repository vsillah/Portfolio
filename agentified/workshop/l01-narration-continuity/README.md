# Agentified L01 narration continuity repair

This provider-free correction removes only the artificial sentence padding from the Human-QA-approved L01 continuous-narration and illustrated composites. It preserves every spoken word, presenter frame, illustration, caption cue, the intentional guided-work interval, and the provider-free closing card.

Run from the repository root:

```bash
node agentified/workshop/l01-narration-continuity/retime.mjs
```

The renderer fails closed unless it finds the exact 55-cue source transcript and 36 artificial ordinary pauses. Corrected ordinary gaps are 0.8 seconds and must remain below the 2.5-second continuity limit. The guided-work interval is identified by its exact surrounding sentences and is not shortened.
