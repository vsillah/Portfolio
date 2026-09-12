import { it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  from: vi.fn(),
  signed: vi.fn(async (_bucket: string, path: string) => "signed:" + path),
  attachment: vi.fn(async (path: string) => ({
    data: { signedUrl: "signed:" + path },
  })),
}));
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: m.from,
    storage: { from: () => ({ createSignedUrl: m.attachment }) },
  },
}));
vi.mock("./storage", () => ({ getSignedUrl: m.signed }));
vi.mock("./client-ai-ops-roadmap-db", () => ({
  getRoadmapBundleForProject: async () => null,
}));
vi.mock("./client-build-evidence", () => ({
  getBuildEvidenceForClientProject: async () => null,
}));
import { getDashboardByToken } from "./client-dashboard";
it.each([false,true])("withholds premature invoice dashboard when signatures=%s", async signed => {
 m.from.mockImplementation((table:string)=>{
  let fields='';
  const result=()=>({data:table==='client_dashboard_access'?{id:'access',client_project_id:'project'}:table==='client_projects'?{id:'project',proposal_id:'proposal',client_email:'synthetic@example.invalid'}:table==='proposals'&&fields.includes('pdf_url')?{id:'proposal',payment_schedule:'milestones',milestone_settlement:'manual_invoice',signed_at:signed?'2026-09-11':null,contract_signed_at:signed?'2026-09-11':null}:table==='installment_plans'?null:[]});
  const q:any={select:(s:string)=>{fields=s;return q;}};
  for(const key of ['gte','eq','order','limit','in','not','update'])q[key]=()=>q;
  q.single=async()=>result();q.maybeSingle=async()=>result();q.then=(resolve:any)=>Promise.resolve(result()).then(resolve);return q;
 });
 const result=await getDashboardByToken('synthetic');
 expect(result.data).toBeNull();expect(result.error).toContain(signed?'initial invoice payment':'agreement');
});
