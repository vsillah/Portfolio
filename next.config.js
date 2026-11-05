/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // Agent portrait assets stay public so protected previews do not break avatar UI.
      { protocol: 'https', hostname: 'amadutown.com' },
      // Printful sync thumbnails + catalog assets (merchandise store)
      { protocol: 'https', hostname: 'files.cdn.printful.com' },
      // Mockup generator output (temporary URLs on S3 accelerate)
      { protocol: 'https', hostname: 'printful-upload.s3-accelerate.amazonaws.com' },
    ],
  },
  experimental: {
    // React PDF reads this local asset at runtime; keep it in the route bundle.
    outputFileTracingIncludes: {
      '/api/proposals': ['./public/amadutown-logo-upscaled.png'],
      '/api/admin/source-protocol/overview': [
        './data/source-protocol/banned-books-source-import-sample.json',
        './data/source-protocol/banned-books-evidence-qa-approvals.sample.json',
      ],
    },
    outputFileTracingExcludes: {
      // This admin route reads the Dark Castle master from public/ at runtime.
      // Its broad trace also catches unrelated, statically served learner media.
      '/api/admin/social-content/*/bind-approved-master': [
        './public/accelerated/lessons/l01/approved-ee09bf72/*',
        './public/accelerated/lessons/l02/approved-ded23edb/*',
        './public/accelerated/lessons/l03/approved-02b9c3ea/*',
        './public/accelerated/lessons/l04/approved-b239a55b/*',
        './public/accelerated/lessons/l05/approved-bd1e53b5/*',
        './public/accelerated/lessons/l06/approved-16167226/*',
        './public/accelerated/lessons/l07/approved-6e3e00a0/*',
        './public/accelerated/lessons/l08/approved-1b6c9da2/*',
        './public/accelerated/lessons/l09/approved-0abafea5/*',
        './public/accelerated/lessons/l10/approved-7beb8af5/*',
        './public/accelerated/lessons/l11/approved-1dcb3b03/*',
        './public/accelerated/lessons/l12/approved-39294821/*',
        './public/accelerated/lessons/l13/approved-4a2974b8/*',
        './public/accelerated/lessons/l14/approved-cf675c5e/*',
        './public/accelerated/lessons/l15/approved-2db525fa/*',
        './public/accelerated/lessons/l16/approved-89c3c668/*',
      ],
    },
    serverActions: {
      bodySizeLimit: '50mb',
    },
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'playwright-core', '@sparticuz/chromium'],
  },
}

module.exports = nextConfig
