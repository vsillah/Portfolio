# Agentified L02-L04 native composites

`render.mjs` reproduces three provider-free 1920×1080 composites from the immutable native sources and approved scene packets. Presenter footage stays at native speed in the opening and closing presenter windows. A conservative local chroma-key and spill-suppression pass removes the provider green-screen field while preserving skin highlights and leaving the native source unchanged. The final lesson holds are provider-free evidence cards.

Run:

```bash
node agentified/workshop/l02-l04-native-composite/render.mjs
node agentified/workshop/l02-l04-native-composite/validate.mjs
node agentified/workshop/l02-l04-native-composite/build-walkthrough.mjs
```

Open `review.html` through a local HTTP server for Human QA.
