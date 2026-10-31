# LinkedIn failure recovery review

This is a privacy-safe, development-only projection of the Dark Castle Social Content status step. The screenshots were captured in the integrated Codex browser from commit `57196abd2e2d2d71cb976266c19a4333ad1c2b0d`. The 12-second MP4 sequences the captured blocked and retryable states at desktop and 390 px mobile widths. It is a still-frame walkthrough of rendered states, not a recording of a live provider interaction.

- Blocked route: `http://localhost:3100/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?qa_fixture=linkedin_failure_recovery_v1&qa_state=blocked&step=status&rev=57196abd`
- Retryable route: `http://localhost:3100/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?qa_fixture=linkedin_failure_recovery_v1&qa_state=retryable&step=status&rev=57196abd`

The fixture is read-only and synthetic. Its controls are disabled. It does not prove that the live record is retryable. Read-only production inspection on October 30 found a pending LinkedIn publish row with a generic scheduler blocker, an approved release gate lacking the later release claim and content fingerprint, and no provider-specific recovery receipt. The live record remains locked for reconciliation. No production row, provider, upload, platform draft, schedule, or publication was changed while preparing this evidence.

Video: `walkthrough.mp4`. Source screenshots: `blocked-desktop.png`, `retryable-desktop.png`, `blocked-mobile.png`, `retryable-mobile.png`.
