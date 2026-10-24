# Dark Castle production recovery link QA

This packet checks the missing-contract recovery path on Social Content record `21c492c2-9279-4e08-afc9-49207935a681`. The local route uses a development-only, read-only projection with placeholder copy. It tests the production record ID and UI path without reading or changing the production row.

The production UI now links to the **same record's Copy step**, where the saved copy can be reviewed. It explains that corrected copy and visual decisions remain pending and that the Integration Captain must bind an exact reviewed contract only after those decisions. The production link contains no QA record ID, localhost destination, or fixture parameter. Rendering and visual decisions remain blocked while the contract is missing.

## Captured path

1. `01-desktop-recovery.jpg`: missing-contract card and same-record recovery action at 1440 × 900.
2. `02-desktop-copy.jpg`: link destination showing saved Copy step at 1440 × 900.
3. `03-phone-recovery.jpg`: same action at 390 × 844.
4. `04-phone-copy.jpg`: link destination at 390 × 844.

`recovery-walkthrough.mp4` plays those browser-captured states in order. `frames.txt` and `render-walkthrough.sh` reproduce the H.264 file. No production copy, credentials, or private record data appear in this packet.

The MP4 is 1440 × 900, 19.97 seconds, 599 frames, with SHA-256 `1f15132423d395230b58d1c9d0638a91fbb159b09b53afc6f04915371c37541d`.

The local QA URL is `/admin/social-content/21c492c2-9279-4e08-afc9-49207935a681?step=visuals&qa_fixture=dark_castle_production_recovery#social-visual-assets-gate`. The `qa_fixture` query works only in local development or tests; hosted deployments ignore it and continue using the authenticated production record. On production, the repaired action points to `/admin/social-content/21c492c2-9279-4e08-afc9-49207935a681?step=copy#social-copy-gate`.

No provider, upload, platform draft, schedule, publication, production write, migration, or external send was performed.
