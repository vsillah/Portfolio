-- Member learning is scoped to a specific edition. Guest data remains in the browser.
CREATE TABLE public.accelerated_member_enrollments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_version text NOT NULL CHECK (char_length(content_version) BETWEEN 1 AND 120),
  current_lesson_id text NOT NULL DEFAULT 'L01' CHECK (current_lesson_id ~ '^L(0[1-9]|1[0-6])$'),
  claim_sha256 text CHECK (claim_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_version)
);
CREATE TABLE public.accelerated_member_lessons (
  user_id uuid NOT NULL,
  content_version text NOT NULL,
  lesson_id text NOT NULL CHECK (lesson_id ~ '^L(0[1-9]|1[0-6])$'),
  completed_at timestamptz,
  video_seconds integer NOT NULL DEFAULT 0 CHECK (video_seconds BETWEEN 0 AND 7200),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_version, lesson_id),
  FOREIGN KEY (user_id, content_version) REFERENCES public.accelerated_member_enrollments(user_id, content_version) ON DELETE CASCADE
);
CREATE TABLE public.accelerated_member_worksheets (
  worksheet_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  content_version text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(answers) = 'object' AND octet_length(answers::text) <= 32000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_version),
  FOREIGN KEY (user_id, content_version) REFERENCES public.accelerated_member_enrollments(user_id, content_version) ON DELETE CASCADE
);
-- Only an operator or approved conversion may insert this link. Email similarity is never authority.
CREATE TABLE public.verified_client_project_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_project_id uuid NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  verification_source text NOT NULL CHECK (verification_source IN ('approved_invitation','checkout_conversion','operator_action')),
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_project_id)
);
-- A submitted Decision File can be bound to its authenticated owner only by reviewed evidence.
CREATE TABLE public.accelerated_decision_file_owners (
  intake_id uuid PRIMARY KEY REFERENCES public.accelerated_decision_file_intakes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.accelerated_member_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_kind text NOT NULL CHECK (offer_kind IN ('service','product')),
  offer_id text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (review_status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

ALTER TABLE public.accelerated_member_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accelerated_member_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accelerated_member_worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_client_project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accelerated_decision_file_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accelerated_member_recommendations ENABLE ROW LEVEL SECURITY;

-- Member writes go through authenticated, validated server routes. Direct reads remain scoped.
CREATE POLICY member_enrollment_read ON public.accelerated_member_enrollments FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY member_lesson_read ON public.accelerated_member_lessons FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY member_worksheet_read ON public.accelerated_member_worksheets FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY verified_project_read ON public.verified_client_project_memberships FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY decision_file_owner_read ON public.accelerated_decision_file_owners FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY reviewed_recommendation_read ON public.accelerated_member_recommendations FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) AND review_status = 'approved');

REVOKE ALL ON public.accelerated_member_enrollments, public.accelerated_member_lessons, public.accelerated_member_worksheets, public.verified_client_project_memberships, public.accelerated_decision_file_owners, public.accelerated_member_recommendations FROM anon, authenticated;
GRANT SELECT ON public.accelerated_member_enrollments, public.accelerated_member_lessons, public.accelerated_member_worksheets, public.verified_client_project_memberships, public.accelerated_decision_file_owners, public.accelerated_member_recommendations TO authenticated;
GRANT ALL ON public.accelerated_member_enrollments, public.accelerated_member_lessons, public.accelerated_member_worksheets, public.verified_client_project_memberships, public.accelerated_decision_file_owners, public.accelerated_member_recommendations TO service_role;
CREATE INDEX accelerated_member_recommendations_owner_idx ON public.accelerated_member_recommendations(user_id, review_status);
