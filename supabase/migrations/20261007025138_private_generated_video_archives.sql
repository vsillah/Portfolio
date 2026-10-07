-- Private generated media. No existing URL/data rewrite; legacy recovery is a separate operator action.
create table public.video_media_archives (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.video_generation_jobs(id),
  provider_video_id text not null,
  bucket text not null default 'generated-video-private' check (bucket = 'generated-video-private'),
  object_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  byte_length bigint not null check (byte_length > 0 and byte_length <= 104857600),
  source_host text not null,
  status text not null default 'pending' check (status in ('pending', 'ready')),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(job_id, provider_video_id)
);
alter table public.video_media_archives enable row level security;
revoke all on public.video_media_archives from public, anon, authenticated;
grant select, insert, update on public.video_media_archives to service_role;
alter table public.video_generation_jobs add column provider_video_url text;
alter table public.videos add column media_archive_id uuid unique references public.video_media_archives(id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('generated-video-private', 'generated-video-private', false, 104857600, array['video/mp4'])
on conflict (id) do nothing;
-- No public/anonymous/authenticated storage policies. Admin server signs short-lived playback after auth.
do $$ begin
  if exists (select 1 from storage.buckets where id = 'generated-video-private' and public) then
    raise exception 'Existing generated-video-private bucket is public; reconcile before applying this migration';
  end if;
end $$;
