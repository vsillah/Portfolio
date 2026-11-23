# Versioned script-derived spoken transcripts

Each `LXX-<script SHA-256 prefix>.txt` contains the eight “Spoken narration — read in full” cells from the exact hashed lesson script, in order. The outer table quotation marks are removed; wording inside each cell is retained. Paragraph breaks separate the eight cells.

`build_source_map.py` records the full source script, bound VTT, and transcript hashes in `source-map-v1.json`. `verify_transcripts.py` independently checks exact transcript derivation and normalized word-sequence equality with the bound VTT. This is a text provenance result; it does not prove character-level identity, full audio performance, or final distribution rights. Earlier unattributed transcript hashes remain lineage only.
