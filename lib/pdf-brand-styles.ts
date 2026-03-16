/**
 * Shared AmaduTown brand styles for generated PDFs (proposal, contract, onboarding plan).
 * Single source for colors and layout so all document PDFs stay consistent.
 * See app/globals.css and docs/design/amadutown-color-palette-audit.md.
 */

export const PDF_BRAND = {
  colors: {
    imperialNavy: '#121E31',
    radiantGold: '#D4AF37',
    siliconSlate: '#2C3E50',
    platinumWhite: '#EAECEE',
    bronze: '#8B6914',
    goldLight: '#F5D060',
  },
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 24,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: '#D4AF37',
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#121E31',
    marginTop: 6,
  },
  documentSubtitle: {
    fontSize: 11,
    color: '#2C3E50',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#2C3E50',
    marginVertical: 16,
  },
  thickDivider: {
    height: 2,
    backgroundColor: '#D4AF37',
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: '#121E31',
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: 10,
    color: '#121E31',
    lineHeight: 1.4,
  },
  bodyTextMuted: {
    fontSize: 9,
    color: '#2C3E50',
    lineHeight: 1.4,
  },
  accent: {
    color: '#D4AF37',
    fontWeight: 'bold' as const,
  },
} as const

export const COMPANY_DISPLAY_NAME = 'AmaduTown Advisory Solutions'
export const COMPANY_SHORT_NAME = 'ATAS'
