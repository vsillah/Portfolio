# Agentified L01 Gray Sweater replacement

This package preserves the single authorized HeyGen source for Agentified L01 and builds a provider-free replacement composite. The source uses the approved Vambah Gray Sweater look and avatar-native voice and plays at native speed. The immutable source retains its provider chroma-green field; the review composite uses a version-bound conservative key and sentence-handoff crossfades to preserve facial detail while returning cleanly to the teaching cards.

The exact source is split at the provider-caption boundary between the two approved passages. The opening passage runs from `00:00.000` to `00:13.633`. The closing passage runs from source `00:13.633` to `00:16.386` and is placed at lesson time `08:38.840` to `08:41.593`. Provider-free evidence cards fill the unused portions of the approved presenter windows, and the approved closing evidence card remains `08:43.000` to `09:00.000`.

Run `node agentified/workshop/l01-gray-sweater-replacement/render.mjs` from the repository root. The renderer uses only local FFmpeg and Sharp dependencies. It makes no provider call and does not modify production or learner-facing bindings.

