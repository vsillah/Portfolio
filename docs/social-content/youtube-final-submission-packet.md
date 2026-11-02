# YouTube final submission review packet

This lane prepares one internal Decision Queue packet after the canonical YouTube privacy decision. It does not record the final decision or authorize YouTube, media providers, uploads, platform drafts, scheduling, or publication.

## Operator entry

1. Open the YouTube Social Content record and select **Submit**.
2. Follow **Prepare internal YouTube Decision Queue packet**. The page displays the current record, privacy receipt, content version, approved master SHA-256, and selected thumbnail direction and SHA-256.
3. Select **Prepare Decision Queue packet** only when the page shows the exact approved privacy gate and media bindings.
4. Open the returned protected Decision Queue route. The packet is pending internal review; any decision remains a separate action.

The database function `prepare_youtube_platform_submission_review` is `SECURITY INVOKER`, executable only by `service_role`, and requires an authenticated admin operator through the API. It compares the immutable privacy decision receipt, current candidate projection, six unique prerequisite receipts, approved media bindings, and the current content version in one transaction. Exact retries return the same work item, approval, and run. Stale or mismatched evidence rolls back without a partial packet.

Migration: `20261102003655_prepare_youtube_platform_submission_review.sql`. Apply and validate in staging through the Integration Captain. This draft PR does not apply it to staging or production and does not prepare a packet for the production record.
