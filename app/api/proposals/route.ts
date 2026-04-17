// API Route: Create Proposal
// POST - Create a new proposal from sales session data
// Now supports optional value_report_id to embed value evidence into the proposal

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { generateProposalPDF, ProposalData, ProposalValueAssessment } from '@/lib/proposal-pdf';
import { generateContractPDF } from '@/lib/contract-pdf';
import { getUpsellPathsForOffer, formatUpsellAsProposalAddon } from '@/lib/upsell-paths';
import { generateAccessCode } from '@/lib/proposal-access-code';
import { generateOnboardingPreviewPDF } from '@/lib/onboarding-preview-pdf';
import { generateAIOnboardingContent, type AIOnboardingContent } from '@/lib/ai-onboarding-generator';
import { buildFeasibilitySnapshot } from '@/lib/feasibility-snapshot';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminResult = await verifyAdmin(request);
    if (isAuthError(adminResult)) {
      return NextResponse.json({ error: adminResult.error }, { status: adminResult.status });
    }

    const body = await request.json();
    const {
      sales_session_id,
      client_name,
      client_email,
      client_company,
      bundle_id,
      bundle_name,
      line_items,
      subtotal,
      discount_amount,
      discount_description,
      total_amount,
      terms_text,
      valid_days = 30, // Default 30 day validity
      value_report_id, // Optional: link to a value evidence report
      include_contract = true,
      include_onboarding_preview = false,
      onboarding_overrides, // Admin-edited AI content
      attached_report_ids = [], // Gamma report IDs to link as proposal_documents
      service_term_months, // Optional: default installment count for this proposal
    } = body;

    // Validate required fields
    if (!client_name || !client_email || !bundle_name || !line_items || total_amount === undefined || total_amount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: client_name, client_email, bundle_name, line_items, total_amount' },
        { status: 400 }
      );
    }

    // =========================================================================
    // For nonprofit/education leads: include a "Compare to Full Service" note
    // in the terms if the bundle is a Community Impact (decoy) bundle
    // =========================================================================
    let isNonprofitProposal = false;
    if (sales_session_id) {
      try {
        const { data: session } = await supabaseAdmin
          .from('sales_sessions')
          .select('diagnostic_audit:diagnostic_audits(org_type)')
          .eq('id', sales_session_id)
          .single();

        const audit = session?.diagnostic_audit as { org_type?: string } | null;
        if (audit?.org_type === 'nonprofit' || audit?.org_type === 'education') {
          isNonprofitProposal = true;
        }
      } catch {
        // Non-critical — continue without nonprofit detection
      }
    }

    // If this is a nonprofit proposal, check if the bundle is a CI bundle
    // and add upgrade path information to the terms
    let effectiveTerms = body.terms_text;
    if (isNonprofitProposal && !effectiveTerms) {
      effectiveTerms = getDefaultTerms() + `\n\n7. Community Impact Program: This proposal uses our Community Impact pricing, designed for nonprofits and educational institutions. The same outcomes are available through our full-service tiers, which include custom-deployed tools, dedicated coaching, outcome-based guarantees, and priority support. Contact us to discuss upgrading if your budget allows or if you secure additional funding.`;
    }

    // =========================================================================
    // Fetch and snapshot value assessment if a value_report_id is provided
    // =========================================================================
    let valueAssessment: ProposalValueAssessment | null = null;

    if (value_report_id) {
      try {
        const { data: valueReport, error: vrError } = await supabaseAdmin
          .from('value_reports')
          .select('*')
          .eq('id', value_report_id)
          .single();

        if (!vrError && valueReport) {
          const statements = (valueReport.value_statements || []) as Array<{
            painPoint: string;
            painPointId?: string;
            annualValue: number;
            calculationMethod: string;
            formulaReadable: string;
            evidenceSummary: string;
            confidence: 'high' | 'medium' | 'low';
          }>;

          const totalAnnualValue = valueReport.total_annual_value || 0;
          const roi = total_amount > 0
            ? Math.round((totalAnnualValue / total_amount) * 10) / 10
            : 0;

          valueAssessment = {
            totalAnnualValue,
            industry: valueReport.industry || '',
            companySizeRange: valueReport.company_size_range || '11-50',
            valueStatements: statements,
            roi,
            roiStatement: `For every $1 invested, ${client_company || 'your business'} stands to recover $${roi.toFixed(1)} in annual value.`,
          };
        }
      } catch (vaError) {
        console.error('Error fetching value report for proposal:', vaError);
        // Continue without value assessment - not critical
      }
    }

    // =========================================================================
    // Auto-include upsell recommendations for decoy/entry-level items
    // Each matching upsell path becomes an optional add-on line item
    // =========================================================================
    let upsellAddons: Array<{
      title: string;
      description: string;
      price: number | null;
      perceived_value: number | null;
      is_optional: boolean;
      risk_reversal: string | null;
      credit_note: string | null;
    }> = [];

    try {
      for (const item of line_items || []) {
        if (item.content_type && item.content_id) {
          const paths = await getUpsellPathsForOffer(item.content_type, item.content_id);
          for (const path of paths) {
            upsellAddons.push(formatUpsellAsProposalAddon(path));
          }
        }
      }
    } catch (upsellError) {
      console.error('Error fetching upsell paths for proposal:', upsellError);
      // Non-critical — continue without upsell add-ons
    }

    // =========================================================================
    // Build stack-aware feasibility snapshot (bundle tech stack vs client stack)
    // Returns null when the feature flag is off, no bundle is selected, or
    // required data is missing. Stored on proposals.feasibility_assessment so
    // the proposal view can render a client-friendly "Implementation fit" block.
    // =========================================================================
    let feasibilityAssessment: Record<string, unknown> | null = null;
    try {
      if (bundle_id) {
        let contactSubmissionId: number | null = null;
        let diagnosticAuditId: string | null = null;
        if (sales_session_id) {
          const { data: sessionLink } = await supabaseAdmin
            .from('sales_sessions')
            .select('contact_submission_id, diagnostic_audit_id')
            .eq('id', sales_session_id)
            .single();
          contactSubmissionId = (sessionLink?.contact_submission_id as number | null) ?? null;
          diagnosticAuditId = (sessionLink?.diagnostic_audit_id as string | null) ?? null;
        }
        const snapshot = await buildFeasibilitySnapshot({
          bundleId: bundle_id,
          contactSubmissionId,
          diagnosticAuditId,
        });
        if (snapshot) {
          feasibilityAssessment = snapshot as unknown as Record<string, unknown>;
        }
      }
    } catch (feasErr) {
      console.error('Error building feasibility snapshot for proposal:', feasErr);
      // Non-critical — continue without feasibility snapshot
    }

    // Calculate valid_until
    const valid_until = new Date();
    valid_until.setDate(valid_until.getDate() + valid_days);

    // Create proposal record (with value assessment snapshot)
    const insertData: Record<string, unknown> = {
      sales_session_id,
      client_name,
      client_email,
      client_company,
      bundle_id,
      bundle_name,
      line_items,
      subtotal: subtotal || total_amount,
      discount_amount: discount_amount || 0,
      discount_description,
      total_amount,
      terms_text: effectiveTerms || terms_text || getDefaultTerms(),
      valid_until: valid_until.toISOString(),
      status: 'draft',
      created_by: adminResult.user.id,
    };

    if (service_term_months && Number(service_term_months) > 0) {
      insertData.service_term_months = Number(service_term_months);
    }

    if (value_report_id) {
      insertData.value_report_id = value_report_id;
    }
    if (valueAssessment) {
      insertData.value_assessment = valueAssessment;
    }
    // Attach upsell add-ons (stored as JSONB, not included in total by default)
    if (upsellAddons.length > 0) {
      insertData.upsell_addons = upsellAddons;
    }
    if (feasibilityAssessment) {
      insertData.feasibility_assessment = feasibilityAssessment;
    }

    const { data: proposal, error: createError } = await supabaseAdmin
      .from('proposals')
      .insert(insertData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating proposal:', createError);
      return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
    }

    // Generate PDF (now with value assessment if present)
    try {
      const pdfData: ProposalData = {
        id: proposal.id,
        client_name: proposal.client_name,
        client_email: proposal.client_email,
        client_company: proposal.client_company,
        bundle_name: proposal.bundle_name,
        line_items: proposal.line_items,
        subtotal: proposal.subtotal,
        discount_amount: proposal.discount_amount,
        discount_description: proposal.discount_description,
        total_amount: proposal.total_amount,
        terms_text: proposal.terms_text,
        valid_until: proposal.valid_until,
        created_at: proposal.created_at,
        value_assessment: valueAssessment || undefined,
      };

      const pdfBuffer = await generateProposalPDF(pdfData);

      // Upload to Supabase Storage
      const fileName = `proposals/${proposal.id}.pdf`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        // Continue without PDF - not critical
      } else {
        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('documents')
          .getPublicUrl(fileName);

        // Update proposal with PDF URL
        await supabaseAdmin
          .from('proposals')
          .update({ pdf_url: urlData.publicUrl })
          .eq('id', proposal.id);

        proposal.pdf_url = urlData.publicUrl;
      }
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
      // Continue without PDF - not critical
    }

    // Generate and upload contract PDF (Software Agreement) — conditional
    if (include_contract !== false) {
      try {
        const contractBuffer = await generateContractPDF({
          client_name: proposal.client_name,
          client_company: proposal.client_company ?? undefined,
          total_amount: proposal.total_amount,
          bundle_name: proposal.bundle_name ?? undefined,
          valid_until: proposal.valid_until,
        });
        const contractFileName = `contracts/${proposal.id}.pdf`;
        const { error: contractUploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(contractFileName, contractBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });
        if (!contractUploadError) {
          const { data: contractUrlData } = supabaseAdmin.storage
            .from('documents')
            .getPublicUrl(contractFileName);
          await supabaseAdmin
            .from('proposals')
            .update({ contract_pdf_url: contractUrlData.publicUrl })
            .eq('id', proposal.id);
          proposal.contract_pdf_url = contractUrlData.publicUrl;
        }
      } catch (contractPdfError) {
        console.error('Error generating/uploading contract PDF:', contractPdfError);
      }
    }

    // Generate and upload onboarding preview PDF — conditional
    if (include_onboarding_preview) {
      try {
        let obContent: AIOnboardingContent | null = onboarding_overrides || null;

        if (!obContent) {
          obContent = await generateAIOnboardingContent({
            line_items: line_items || [],
            client_name,
            client_company,
            bundle_name,
            contact_submission_id: undefined,
            diagnostic_audit_id: undefined,
            value_report_id: value_report_id || undefined,
          });
        }

        if (obContent) {
          const obBuffer = await generateOnboardingPreviewPDF({
            client_name: proposal.client_name,
            client_company: proposal.client_company,
            bundle_name: proposal.bundle_name,
            content: obContent,
          });

          const obFileName = `onboarding-previews/${proposal.id}.pdf`;
          const { error: obUploadError } = await supabaseAdmin.storage
            .from('documents')
            .upload(obFileName, obBuffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (!obUploadError) {
            const { data: maxOrderRow } = await supabaseAdmin
              .from('proposal_documents')
              .select('display_order')
              .eq('proposal_id', proposal.id)
              .order('display_order', { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextOrder = ((maxOrderRow?.display_order as number) ?? -1) + 1;

            await supabaseAdmin
              .from('proposal_documents')
              .insert({
                proposal_id: proposal.id,
                document_type: 'onboarding_preview',
                title: 'Client Onboarding Preview',
                file_path: obFileName,
                display_order: nextOrder,
                source: 'generated',
              });
          }
        }
      } catch (obError) {
        console.error('Error generating onboarding preview PDF:', obError);
      }
    }

    // Link attached gamma reports as proposal_documents
    if (Array.isArray(attached_report_ids) && attached_report_ids.length > 0) {
      try {
        const { data: gammaRows } = await supabaseAdmin
          .from('gamma_reports')
          .select('id, title, report_type, pdf_url')
          .in('id', attached_report_ids)
          .not('pdf_url', 'is', null);

        if (gammaRows && gammaRows.length > 0) {
          const { data: maxOrderRow } = await supabaseAdmin
            .from('proposal_documents')
            .select('display_order')
            .eq('proposal_id', proposal.id)
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle();
          let nextOrder = ((maxOrderRow?.display_order as number) ?? -1) + 1;

          const docTypeMap: Record<string, string> = {
            value_quantification: 'opportunity_quantification',
            implementation_strategy: 'strategy_report',
            audit_summary: 'strategy_report',
            prospect_overview: 'other',
            offer_presentation: 'offer_presentation',
          };

          for (const gr of gammaRows) {
            await supabaseAdmin
              .from('proposal_documents')
              .insert({
                proposal_id: proposal.id,
                document_type: docTypeMap[gr.report_type] || 'other',
                title: gr.title || `${gr.report_type} Report`,
                file_path: gr.pdf_url!,
                display_order: nextOrder,
                source: 'generated',
                gamma_report_id: gr.id,
              });
            nextOrder++;
          }
        }
      } catch (reportLinkError) {
        console.error('Error linking gamma reports to proposal:', reportLinkError);
      }
    }

    // Generate access code and update proposal (retry on collision)
    let accessCode: string | null = null;
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const candidate = generateAccessCode();
      const { error: codeError } = await supabaseAdmin
        .from('proposals')
        .update({ access_code: candidate })
        .eq('id', proposal.id);

      if (!codeError) {
        accessCode = candidate;
        proposal.access_code = candidate;
        break;
      }
      if (codeError.code !== '23505') {
        console.error('Error setting proposal access code:', codeError);
        break;
      }
    }

    // Generate proposal link - use request origin for dev, env var for production
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const proposalLink = accessCode
      ? `${baseUrl}/proposal/${accessCode}`
      : `${baseUrl}/proposal/${proposal.id}`;

    return NextResponse.json({
      proposal,
      proposalLink,
      accessCode: accessCode ?? undefined,
    }, { status: 201 });

  } catch (error) {
    console.error('Error in proposals POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Default terms text
function getDefaultTerms(): string {
  return `1. Payment Terms: Payment is due upon acceptance of this proposal.

2. Scope of Work: This proposal covers only the items listed above. Any additional work or changes will be quoted separately.

3. Delivery: Delivery timelines will be confirmed upon acceptance and may vary based on current workload.

4. Refund Policy: Digital products and services are non-refundable once delivered. Please review all items carefully before accepting.

5. Confidentiality: Both parties agree to keep confidential any proprietary information shared during the engagement.

6. Acceptance: This proposal is valid for the period indicated. Acceptance of this proposal indicates agreement to these terms.`;
}
