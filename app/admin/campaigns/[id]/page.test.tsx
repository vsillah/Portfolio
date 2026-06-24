import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignDetailPage from './page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}));

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}));

const campaignDetail = {
  id: 'campaign-1',
  name: 'Agent Ops Campaign',
  slug: 'agent-ops-campaign',
  description: 'Campaign for governed AI operating layer content.',
  campaign_type: 'standard',
  status: 'draft',
  starts_at: '2026-06-24T00:00:00.000Z',
  ends_at: '2026-07-01T00:00:00.000Z',
  completion_window_days: 30,
  campaign_eligible_bundles: [],
  campaign_criteria_templates: [],
  calendar_item_count: 1,
  next_calendar_item: null,
  social_content_calendar_items: [
    {
      id: 'calendar-1',
      title: 'Tease: Approval gates',
      channel: 'linkedin',
      campaign_phase: 'tease',
      planned_angle: 'Open with the moment an approval path created extra work.',
      scheduled_for: '2026-06-25T14:00:00.000Z',
      due_status: 'planned',
      authorization_status: 'pending',
      authorization_due_at: '2026-06-24T14:00:00.000Z',
      agent_work_item_id: 'work-social-1',
      social_content_id: null,
      metadata: {},
    },
  ],
};

describe('CampaignDetailPage content calendar gates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/admin/campaigns/campaign-1') {
        return {
          ok: true,
          json: async () => ({ data: campaignDetail }),
        };
      }

      if (url === '/api/admin/campaigns/campaign-1/enrollments') {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url === '/api/admin/sales/bundles') {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }

      if (url === '/api/admin/social-content/calendar/calendar-1/authorize') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: {
              ...campaignDetail.social_content_calendar_items[0],
              authorization_status: 'authorized',
              social_content_id: 'social-1',
            },
            handoff: {
              kind: 'linkedin_social_content_draft',
              work_item_id: 'work-handoff-1',
              social_content_id: 'social-1',
            },
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              internal_draft_handoff_created: true,
              social_content_draft_created: true,
            },
          }),
        };
      }

      if (url === '/api/admin/social-content/calendar/calendar-1/reject') {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            item: {
              ...campaignDetail.social_content_calendar_items[0],
              authorization_status: 'rejected',
            },
            revision_work_item_id: 'work-revision-1',
            side_effects: {
              provider_generation: false,
              upload: false,
              external_schedule: false,
              publish: false,
              external_post: false,
              revision_work_item_created: true,
            },
          }),
        };
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ error: `Unhandled ${url}`, method: init?.method || 'GET' }),
      };
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows campaign calendar authorization actions and authorizes a draft handoff', async () => {
    render(<CampaignDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Agent Ops Campaign' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Content Calendar1' }));

    expect(screen.getByText('Tease: Approval gates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authorize Draft Handoff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Authorize Draft Handoff' }));

    await screen.findByText('Draft handoff authorized and Social Content draft created.');

    const authorizeCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/authorize'
    ));
    expect(authorizeCall).toBeTruthy();
    expect(authorizeCall?.[1]).toMatchObject({ method: 'POST' });
    expect(new Headers(authorizeCall?.[1]?.headers).get('Authorization')).toBe('Bearer admin-token');
    expect(JSON.parse(String(authorizeCall?.[1]?.body))).toEqual({});

    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === '/api/admin/campaigns/campaign-1').length).toBeGreaterThan(1);
    });
  });

  it('requires a decision note when rejecting a campaign calendar item', async () => {
    render(<CampaignDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Agent Ops Campaign' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Content Calendar1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    fireEvent.change(screen.getByLabelText('Decision note'), {
      target: { value: 'Needs a stronger proof point before this campaign item is due.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Rejection' }));

    await screen.findByText('Calendar item rejected and returned to Shaka for revision.');

    const rejectCall = vi.mocked(fetch).mock.calls.find(([input]) => (
      String(input) === '/api/admin/social-content/calendar/calendar-1/reject'
    ));
    expect(rejectCall).toBeTruthy();
    expect(JSON.parse(String(rejectCall?.[1]?.body))).toEqual({
      decision_note: 'Needs a stronger proof point before this campaign item is due.',
    });
  });
});
