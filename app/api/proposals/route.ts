// API Route: Create Proposal
// POST - Create a new proposal from sales session data
// Now supports optional value_report_id to embed value evidence into the proposal

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { generateProposalPDF, ProposalData, ProposalValueAssessment } from '@/lib/proposal-pdf';

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

    // Attach value evidence columns if available
    if (value_report_id) {
      insertData.value_report_id = value_report_id;
    }
    if (valueAssessment) {
      insertData.value_assessment = valueAssessment;
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

    // Generate proposal link - use request origin for dev, env var for production
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const proposalLink = `${baseUrl}/proposal/${proposal.id}`;

    return NextResponse.json({
      proposal,
      proposalLink,
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
