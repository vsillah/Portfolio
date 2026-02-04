// API Route: Create Proposal
// POST - Create a new proposal from sales session data

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdmin, isAuthError } from '@/lib/auth-server';
import { generateProposalPDF, ProposalData } from '@/lib/proposal-pdf';

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
    } = body;

    // Validate required fields
    if (!client_name || !client_email || !bundle_name || !line_items || total_amount === undefined || total_amount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: client_name, client_email, bundle_name, line_items, total_amount' },
        { status: 400 }
      );
    }

    // Calculate valid_until
    const valid_until = new Date();
    valid_until.setDate(valid_until.getDate() + valid_days);

    // Create proposal record
    const { data: proposal, error: createError } = await supabaseAdmin
      .from('proposals')
      .insert({
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
        terms_text: terms_text || getDefaultTerms(),
        valid_until: valid_until.toISOString(),
        status: 'draft',
        created_by: adminResult.user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating proposal:', createError);
      return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
    }

    // Generate PDF
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
