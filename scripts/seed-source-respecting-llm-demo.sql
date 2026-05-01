-- Safe demo seed for the Source-Respecting LLM Protocol.
-- Uses invented text only. Do not replace with copyrighted excerpts unless rights are verified.

WITH creator AS (
  INSERT INTO source_creators (
    id,
    display_name,
    categories,
    rights_holder_types,
    verification_status,
    protected_identity,
    public_bio,
    admin_notes
  )
  VALUES (
    '11111111-1111-4111-8111-111111111111',
    'Demo Challenged Author',
    ARRAY['banned_author', 'challenged_author'],
    ARRAY['author'],
    'verified',
    FALSE,
    'Synthetic demo creator for source-respecting protocol testing.',
    'Demo data only. No real copyrighted text is included.'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    categories = EXCLUDED.categories,
    rights_holder_types = EXCLUDED.rights_holder_types,
    verification_status = EXCLUDED.verification_status,
    updated_at = NOW()
  RETURNING id
),
work AS (
  INSERT INTO licensed_works (
    id,
    creator_id,
    title,
    rights_holder_type,
    ban_status,
    source_type,
    source_reference,
    chain_of_title_verified,
    community_consent_required,
    community_consent_verified,
    review_status,
    admin_notes
  )
  SELECT
    '22222222-2222-4222-8222-222222222222',
    id,
    'Demo Book About Access',
    'author',
    'challenged',
    'manual',
    'synthetic-demo',
    TRUE,
    FALSE,
    FALSE,
    'approved',
    'Synthetic work for testing citation, license, and payout flow.'
  FROM creator
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    ban_status = EXCLUDED.ban_status,
    chain_of_title_verified = EXCLUDED.chain_of_title_verified,
    review_status = EXCLUDED.review_status,
    updated_at = NOW()
  RETURNING id, creator_id
),
grant_row AS (
  INSERT INTO license_grants (
    id,
    work_id,
    status,
    allowed_uses,
    blocked_topics,
    quote_limit_characters,
    grant_document_reference,
    granted_by,
    reviewed_at
  )
  SELECT
    '33333333-3333-4333-8333-333333333333',
    id,
    'active',
    ARRAY['retrieval', 'citation', 'summarization', 'educational', 'commercial'],
    ARRAY['minors_private_data', 'doxxing'],
    280,
    'synthetic-demo-license',
    'Demo Challenged Author',
    NOW()
  FROM work
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    allowed_uses = EXCLUDED.allowed_uses,
    blocked_topics = EXCLUDED.blocked_topics,
    quote_limit_characters = EXCLUDED.quote_limit_characters,
    updated_at = NOW()
  RETURNING id, work_id
)
INSERT INTO source_chunks (
  id,
  work_id,
  creator_id,
  active_license_grant_id,
  chunk_text,
  text_hash,
  citation_label,
  source_location,
  sensitive_topics,
  is_retrievable
)
SELECT
  '44444444-4444-4444-8444-444444444444',
  work.id,
  work.creator_id,
  grant_row.id,
  'Access changes what people can imagine, and imagination changes what people are willing to build.',
  'demo-hash-access-imagination-build',
  'Demo Book About Access, synthetic excerpt 1',
  'demo-p.1',
  ARRAY[]::TEXT[],
  TRUE
FROM work
JOIN grant_row ON grant_row.work_id = work.id
ON CONFLICT (id) DO UPDATE SET
  active_license_grant_id = EXCLUDED.active_license_grant_id,
  chunk_text = EXCLUDED.chunk_text,
  text_hash = EXCLUDED.text_hash,
  citation_label = EXCLUDED.citation_label,
  source_location = EXCLUDED.source_location,
  is_retrievable = EXCLUDED.is_retrievable,
  updated_at = NOW();
