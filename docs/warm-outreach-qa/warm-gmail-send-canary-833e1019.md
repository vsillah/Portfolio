# Warm Gmail Send Canary Receipt

Date recorded: 2026-08-28

Scope: one-recipient warm Gmail production canary for outreach queue `833e1019-97c3-4059-8790-c590841328d1`.

Evidence:
- Queue status: `sent`
- `gmail_send_called`: `true`
- `external_send_performed`: `true`
- Gmail message id: `1a0480e4075c5c26`
- Gmail thread id: `1a046009d018c9fd`
- Execution was bounded to the exact approved recipient/queue/message path.
- Production execution flag was removed after the canary and production was redeployed fail-closed.

Operator rule:
This receipt is proof that the one-recipient canary already ran. Do not replay this queue row or reuse its submitted-evidence key for another send. Future live sends still require explicit per-recipient approval, matching deterministic keys, draft evidence, sender identity match, suppression clearance, provider readiness, and an admin activation gate.

