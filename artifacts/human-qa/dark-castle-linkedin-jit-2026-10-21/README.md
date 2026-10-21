# Dark Castle LinkedIn local Human QA evidence

The 19.96-second [MP4 walkthrough](dark-castle-linkedin-jit-walkthrough.mp4) records the exact repository-bound Social Content route at code commit `03178d07`, first at 1440 × 900 and then at 390 × 844. It shows the proposed copy and visual, the stale JIT blocker, the expanded source trace, and disabled Approve/Reject actions. The route is:

`http://127.0.0.1:5218/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?qa_fixture=social_campaign_review_assets_v1&rev=03178d07`

The fixture is read only. Playwright blocked every non-localhost request during recording. The run recorded `visualLoaded=true`, `approvalDisabled=true`, `rejectDisabled=true`, and `noOverflow=true` at both viewport sizes in [results.json](results.json). The mobile review card scrolls under the existing sticky review bar; inspect the complete [customer-facing visual](../../../public/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png) separately at full size.

The final MP4 is H.264, 1280 × 800, 25 fps, 499 frames, 19.96 seconds, SHA-256 `af4f63af8cd347c4ee73cc9a41c4e5ad6189f7ff43f6d41b415e70e314e87d23`. FFprobe and a decoded frame verified that it is playable. Source WebM files were intermediate recordings. No provider call, upload, platform draft, schedule, publish, external send, credential change, migration, or production content write occurred.

The JIT receipt expired October 20, 2026. This evidence supports review of the candidate only; it does not clear the source refresh or external-execution gates.
