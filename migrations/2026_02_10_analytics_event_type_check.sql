-- Update the event_type check constraint on analytics_events
-- The original constraint only allowed: page_view, click, download, purchase, signup, custom
-- The client also sends: section_view, form_submit, video_play, scroll, time_on_page

ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_event_type_check;

ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_event_type_check
  CHECK (event_type IN (
    'page_view',
    'section_view',
    'click',
    'form_submit',
    'video_play',
    'scroll',
    'time_on_page',
    'download',
    'purchase',
    'signup',
    'custom'
  ));
