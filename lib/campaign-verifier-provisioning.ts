import { createHash } from 'node:crypto'
import { z } from 'zod'

// Pure metadata branch of the existing credential broker. No resolver imports,
// environment reads, database clients, provider SDKs or transport capabilities.
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const identity = z.object({
  principal: z.string().regex(/^campaign_v_[a-z0-9_]{1,40}$/),
  verifierId: z.uuid(), version,
}).strict()
const credential = z.object({
  referenceId: z.uuid(), version,
  provider: z.enum(['linkedin','instagram','facebook','x','tiktok','gmail','heygen','youtube','manual_social']),
  accountDigest: digest, environment: z.enum(['staging','production']),
  // Digest of the approved broker inventory ID; never a resolver URI or secret hash.
  brokerEntryDigest: digest,
}).strict()
export const provisioningSchema = z.object({
  protocol: z.literal('campaign-verifier-provisioning/v1'), commandId: z.uuid(),
  operation: z.enum(['provision','activate','rotate','revoke']).default('provision'),
  targetId: z.uuid(),
  databaseName: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
  identity, credential,
  expectedIdentityVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expectedCredentialVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict().superRefine((p, ctx) => {
  const provision = p.operation === 'provision', rotate = p.operation === 'rotate'
  if (provision ? p.expectedIdentityVersion !== 0 || p.expectedCredentialVersion !== 0 || p.identity.version !== 1 || p.credential.version !== 1
    : p.expectedIdentityVersion < 1 || p.expectedCredentialVersion < 1 ||
      p.identity.version !== p.expectedIdentityVersion + (rotate ? 1 : 0) ||
      p.credential.version !== p.expectedCredentialVersion + (rotate ? 1 : 0)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid lifecycle versions' })
  }
})
export type VerifierProvisioningInput = z.input<typeof provisioningSchema>
export type VerifierProvisioningProjection = z.output<typeof provisioningSchema>

export function generateVerifierProvisioning(input: unknown) {
  const parsed = provisioningSchema.safeParse(input)
  if (!parsed.success) throw new Error('Invalid verifier metadata packet')
  const p = parsed.data
  // Key order is fixed by the strict schema; no caller-supplied unknown fields survive.
  const packetDigest = createHash('sha256').update(JSON.stringify(p)).digest('hex')
  const i = p.identity, c = p.credential
  const role = `"${i.principal}"`
  const active = p.operation === 'activate'
  const sql = `-- Generated metadata package. Review only; no connection or login creation.
-- Requires a separately supplied, transaction-local campaign.provisioning_authorization.
-- Bind that setting to the packet digest after action-time approval; it is not a secret.
DO $provision$
DECLARE
  prior campaign_verifier.provisioning_events;
  ident campaign_verifier.identities;
  cred campaign_verifier.credential_references;
  principal_oid oid;
BEGIN
  IF '${c.environment}' <> 'staging' OR current_database() <> '${p.databaseName}' THEN
    RAISE EXCEPTION 'Staging database binding required; production refused';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM campaign_verifier.deployment_target WHERE singleton
      AND target_id='${p.targetId}' AND database_name=current_database() AND environment='staging' FOR SHARE) THEN
    RAISE EXCEPTION 'Owner-installed staging target pin required';
  END IF;
  IF current_user <> session_user OR current_user <> (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='campaign_verifier') THEN
    RAISE EXCEPTION 'Direct schema owner connection required';
  END IF;
  IF current_setting('campaign.provisioning_authorization',true) IS DISTINCT FROM '${packetDigest}' THEN
    RAISE EXCEPTION 'Separate action-time authorization required';
  END IF;
  -- Same journal lock as ingest: no partial identity/reference changes across readback.
  PERFORM 1 FROM public.campaign_execution_journal WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign journal required'; END IF;
  IF clock_timestamp() >= '${p.expiresAt}'::timestamptz THEN RAISE EXCEPTION 'Provisioning approval expired'; END IF;
  SELECT * INTO prior FROM campaign_verifier.provisioning_events WHERE command_id='${p.commandId}';
  IF FOUND THEN
    IF prior.packet_digest <> '${packetDigest}' THEN RAISE EXCEPTION 'Conflicting provisioning replay'; END IF;
    RETURN; -- Historical replay never restores an old active state or version.
  END IF;
  ${p.operation !== 'revoke' ? `SELECT oid INTO principal_oid FROM pg_roles WHERE rolname='${i.principal}'
    AND rolcanlogin AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolbypassrls;
  IF principal_oid IS NULL OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=principal_oid OR roleid=principal_oid) THEN
    RAISE EXCEPTION 'Isolated existing verifier LOGIN required';
  END IF;
  -- Check effective privileges, including PUBLIC. Never silently repair an overprivileged role.
  IF EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE (n.nspname='campaign_verifier' OR (n.nspname='public' AND t.relname LIKE 'campaign_%'))
      AND t.relkind IN ('r','p','v','m','f')
      AND (has_table_privilege(principal_oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(principal_oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
    OR EXISTS(SELECT 1 FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace
      WHERE (n.nspname='campaign_verifier' OR (n.nspname='public' AND f.proname LIKE 'campaign_%'))
      AND f.oid <> 'campaign_verifier.ingest(jsonb)'::regprocedure
      AND has_function_privilege(principal_oid,f.oid,'EXECUTE'))
    OR has_schema_privilege(principal_oid,'campaign_verifier','CREATE,USAGE WITH GRANT OPTION')
    OR has_function_privilege(principal_oid,'campaign_verifier.ingest(jsonb)','EXECUTE WITH GRANT OPTION') THEN
    RAISE EXCEPTION 'Verifier has excess effective privileges';
  END IF;` : ''}
  SELECT * INTO ident FROM campaign_verifier.identities WHERE principal='${i.principal}' FOR UPDATE;
  SELECT * INTO cred FROM campaign_verifier.credential_references WHERE reference_id='${c.referenceId}' FOR UPDATE;
  ${p.operation === 'provision' ? `IF ident.principal IS NOT NULL OR cred.reference_id IS NOT NULL THEN RAISE EXCEPTION 'Projection already exists'; END IF;
  INSERT INTO campaign_verifier.identities VALUES ('${i.principal}','${i.verifierId}',1,false);
  INSERT INTO campaign_verifier.credential_references VALUES ('${c.referenceId}',1,'${c.provider}','${c.accountDigest}','${c.environment}',false);`
    : `IF NOT EXISTS(SELECT 1 FROM campaign_verifier.provisioning_events WHERE operation='provision'
      AND verifier_id='${i.verifierId}' AND reference_id='${c.referenceId}' AND broker_entry_digest='${c.brokerEntryDigest}') THEN
    RAISE EXCEPTION 'Broker projection binding required'; END IF;
  IF ident.verifier_id IS DISTINCT FROM '${i.verifierId}'::uuid OR ident.version IS DISTINCT FROM ${p.expectedIdentityVersion}::bigint
    OR cred.version IS DISTINCT FROM ${p.expectedCredentialVersion}::bigint OR cred.provider IS DISTINCT FROM '${c.provider}'
    OR cred.account_digest IS DISTINCT FROM '${c.accountDigest}' OR cred.environment IS DISTINCT FROM '${c.environment}' THEN
    RAISE EXCEPTION 'Exact projection/version binding required'; END IF;
  ${active ? `IF EXISTS(SELECT 1 FROM campaign_verifier.provisioning_events WHERE operation='revoke'
    AND (verifier_id='${i.verifierId}' AND identity_version=${i.version} OR reference_id='${c.referenceId}' AND credential_version=${c.version})) THEN
    RAISE EXCEPTION 'Revoked version cannot reactivate; rotate first'; END IF;` : ''}
  UPDATE campaign_verifier.identities SET version=${i.version},active=${active} WHERE principal='${i.principal}';
  UPDATE campaign_verifier.credential_references SET version=${c.version},active=${active} WHERE reference_id='${c.referenceId}';`}
  ${active ? `GRANT USAGE ON SCHEMA campaign_verifier TO ${role};
  GRANT EXECUTE ON FUNCTION campaign_verifier.ingest(jsonb) TO ${role};`
    : `REVOKE ALL ON SCHEMA campaign_verifier FROM ${role};
  REVOKE ALL ON FUNCTION campaign_verifier.ingest(jsonb) FROM ${role};`}
  ${p.operation === 'rotate' || p.operation === 'revoke' ? `UPDATE campaign_verifier.authorizations a SET revoked_at=coalesce(a.revoked_at,clock_timestamp())
    FROM public.campaign_provider_qualifications q WHERE q.run_id=a.run_id
    AND (q.scope->>'verifierId'='${i.verifierId}' OR q.scope->>'credentialReferenceId'='${c.referenceId}');` : ''}
  IF clock_timestamp() >= '${p.expiresAt}'::timestamptz THEN RAISE EXCEPTION 'Provisioning approval expired after locks'; END IF;
  INSERT INTO campaign_verifier.provisioning_events(command_id,packet_digest,broker_entry_digest,operation,verifier_id,reference_id,identity_version,credential_version)
    VALUES('${p.commandId}','${packetDigest}','${c.brokerEntryDigest}','${p.operation}','${i.verifierId}','${c.referenceId}',${i.version},${c.version});
END $provision$;
`
  return { projection: p, packetDigest, mode: 'generate-only' as const,
    providerEnabled: false as const, credentialReads: 0 as const, externalRequests: 0 as const, sql }
}
