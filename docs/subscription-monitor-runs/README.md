# Subscription Monitor Runs

This folder stores full sanitized daily artifacts from the Portfolio subscription cancellation monitor.

Future monitor runs should write the detailed report here first, using:

```text
docs/subscription-monitor-runs/YYYY-MM-DD.md
```

The main audit document, `docs/subscription-cancellation-audit.md`, should stay compact: one daily heading, status, artifact link, and short material summary. This prevents the durable tracker from becoming the raw monitor log while preserving full run history for audit and follow-up.
