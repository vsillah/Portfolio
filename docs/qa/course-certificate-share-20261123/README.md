# Course certificate sharing review

This packet is for draft PR stacked on #1302. It uses the development-only member dashboard fixture at code commit `3763634edf60adbd1de6cfe1cd752d05e4e32f90`. No learner account or real social platform was contacted.

## Routes

- Accelerated: `http://127.0.0.1:3189/member/dashboard?qa=completion-ready&rev=3763634edf60adbd1de6cfe1cd752d05e4e32f90`. The recording claims the synthetic certificate in the fixture.
- Agentified: `http://127.0.0.1:3189/member/dashboard?qa=agentified-credential&certificate=claimed&certificateTheme=dark&rev=3763634edf60adbd1de6cfe1cd752d05e4e32f90`.

Each course has desktop 1280×800 and mobile 390×844 MP4s showing default, LinkedIn copy success, Facebook copy failure, retry success, and X handoff. The browser script checks one intercepted destination opening, expected URL, one clipboard write for LinkedIn/Facebook, no clipboard write for X, retry only after failure, retry removal, 44×44 targets, one row, and no horizontal overflow. On mobile it activates the failed Facebook path with Enter. The share destinations were intercepted with synthetic responses before navigation. The recorder is `scripts/record-course-certificate-share-qa.mjs`.

| File | SHA-256 |
| --- | --- |
| `accelerated-desktop.mp4` | `0f326b37be36d34ca635a8c971b46b370b325cdb69483970fd32f79c8e38375b` |
| `accelerated-mobile.mp4` | `4685a78cf6d64da127706a696ae30b23fb5888ca98c7440ce538d70670873d1f` |
| `agentified-desktop.mp4` | `aa5e3357d4f49f2114edbcc7bdfb12dd65ae668df33cafd7824897e7496a5b0a` |
| `agentified-mobile.mp4` | `1da8648dc19263f030b754174409860ae557772bec8ce7908a8a3153022450a8` |

All four MP4s decoded. Accelerated retains its verification-link copy utility separately from social sharing. The certificate artwork, issue flow, and verification routes were not modified. No post, manual deployment, production canary, merge, provider call, or release was performed.
