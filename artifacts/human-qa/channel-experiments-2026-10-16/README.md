# Channel experiment review QA

- Source commit: `51e21480`
- Exact route: `http://127.0.0.1:3107/admin/agents/content-intelligence?section=research&packet=407df879-a539-40a1-a20e-75de31b9c494&qa_fixture=channel_experiments_v1&rev=51e21480`
- Viewports: 1440 x 900 and 390 x 844
- Themes: light and dark
- Interactions: fresh direct entry, in-route campaign-link navigation across all three packets, browser back/forward, LinkedIn variant A, YouTube channel switch, and YouTube variant B

The route is a development-only fixture that mounts the shipped review component with static, approved packet summaries. It performs no production reads or writes and exposes no render, upload, draft, schedule, publish, or send action.

The capture blocked the expected Vercel Speed Insights probes in the browser. The receipt records zero completed external requests and includes the MP4 checksum and codec probe.
