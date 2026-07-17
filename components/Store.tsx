'use client'

import { useState, useEffect, useMemo } from 'react'
import { ShoppingBag, ArrowRight, ShoppingCart, Package } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import type { Product } from '@/lib/types/store'
import { formatPriceOrFree } from '@/lib/pricing-model'
import { resolveThemeImageUrl } from '@/lib/visual-asset-variants'

const TYPE_LABELS: Record<string, string> = {
  ebook: 'E-Book',
  training: 'Training',
  calculator: 'Calculator',
  music: 'Music',
  app: 'App',
  merchandise: 'Merchandise',
  template: 'Template',
}

const SECTION_BG = 'px-6 sm:px-10 lg:px-12 relative overflow-hidden'
const PRODUCTS_SECTION_BG =
  'pt-40 pb-32 bg-[linear-gradient(180deg,#f4f6fa_0%,#eef2f7_42%,rgba(255,255,255,0.92)_100%)] dark:bg-[linear-gradient(180deg,#121E31_0%,rgba(18,30,49,0.98)_28%,rgba(44,62,80,0.10)_100%)]'
const MERCHANDISE_BG = 'bg-background/20'

function ProductCard({
  product,
  index,
  onClick,
  ctaLabel = 'View Product',
}: {
  product: Product
  index: number
  onClick: () => void
  ctaLabel?: string
}) {
  const { resolvedTheme } = useTheme()
  const imageUrl = resolveThemeImageUrl({
    imageUrl: product.image_url,
    imageVariants: product.image_variants,
    theme: resolvedTheme,
  })

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#121E31]/10 bg-white/[0.88] shadow-[0_18px_42px_rgba(18,30,49,0.10)] backdrop-blur-md transition-all duration-500 hover:border-radiant-gold/35 hover:shadow-[0_22px_54px_rgba(18,30,49,0.14)] dark:border-radiant-gold/5 dark:bg-silicon-slate/40 dark:shadow-none dark:hover:border-radiant-gold/20 reveal-on-scroll is-visible"
      style={{ transitionDelay: `${index * 0.1}s` }}
    >
      <div className="relative h-64 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, 320px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted dark:bg-background">
            <ShoppingBag className="text-radiant-gold/35 dark:text-radiant-gold/20" size={48} />
          </div>
        )}
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          <span className="rounded-full border border-radiant-gold/25 bg-white/90 px-3 py-1 font-heading text-[10px] uppercase tracking-widest text-radiant-gold backdrop-blur-md dark:bg-background/80 dark:border-radiant-gold/20">
            {TYPE_LABELS[product.type] || product.type}
          </span>
          {product.is_featured && (
            <span className="rounded-full bg-radiant-gold px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-widest text-imperial-navy">
              Featured
            </span>
          )}
        </div>
        <div className="absolute bottom-6 right-6 rounded-full border border-radiant-gold/25 bg-white/[0.92] px-4 py-2 font-heading text-sm tracking-tighter text-radiant-gold backdrop-blur-md dark:bg-background/90 dark:border-radiant-gold/20">
          {formatPriceOrFree(product.price ?? 0)}
        </div>
      </div>
      <div className="p-8">
        <h3 className="mb-3 font-premium text-2xl text-[#121E31] transition-colors group-hover:text-radiant-gold dark:text-foreground">
          {product.title}
        </h3>
        {product.description && (
          <p className="mb-8 line-clamp-2 font-body text-sm text-[#475569] dark:text-muted-foreground/90">
            {product.description}
          </p>
        )}
        <div className="flex w-full items-center justify-center gap-3 rounded-full border border-[#121E31]/[0.14] py-3 text-[#121E31]/[0.78] transition-all duration-300 group-hover:border-radiant-gold group-hover:bg-radiant-gold group-hover:text-imperial-navy dark:border-radiant-gold/20 dark:text-foreground">
          <ShoppingCart size={14} />
          <span className="text-[10px] font-heading tracking-widest uppercase">{ctaLabel}</span>
        </div>
      </div>
    </div>
  )
}

type StoreSection = 'products' | 'merchandise' | 'all'

export default function Store({ section = 'all' }: { section?: StoreSection }) {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const showProducts = section === 'all' || section === 'products'
  const showMerchandise = section === 'all' || section === 'merchandise'

  useEffect(() => {
    let timeoutId: number | null = null
    const fetchProducts = async (retry = false) => {
      if (retry) setLoading(true)
      try {
        const response = await fetch('/api/products?active=true')
        if (response.ok) {
          const data = await response.json()
          setAllProducts(data || [])
        }
      } catch (error) {
        console.error('Error fetching products:', error)
        if (!retry) {
          timeoutId = window.setTimeout(() => fetchProducts(true), 2000)
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [])

  const { digitalProducts, merchandise } = useMemo(() => {
    const digital = (allProducts || [])
      .filter((p: Product) => p.type !== 'merchandise')
      .sort((a: Product, b: Product) => {
        if (a.is_featured && !b.is_featured) return -1
        if (!a.is_featured && b.is_featured) return 1
        return 0
      })
      .slice(0, 6)
    const merch = (allProducts || [])
      .filter((p: Product) => p.type === 'merchandise')
      .sort((a: Product, b: Product) => {
        if (a.is_featured && !b.is_featured) return -1
        if (!a.is_featured && b.is_featured) return 1
        return 0
      })
      .slice(0, 6)
    return { digitalProducts: digital, merchandise: merch }
  }, [allProducts])

  const handleProductClick = (productId: number) => {
    router.push(`/store/${productId}`)
  }

  if (loading) {
    return (
      <>
        {showProducts && (
          <section id="products" className={`${SECTION_BG} ${PRODUCTS_SECTION_BG}`}>
            <div className="max-w-7xl mx-auto text-center">
              <div className="mx-auto h-10 w-48 animate-pulse rounded-full bg-[#121E31]/10 dark:bg-silicon-slate/20" />
            </div>
          </section>
        )}
        {showMerchandise && (
          <section id="merchandise" className={`${SECTION_BG} ${MERCHANDISE_BG} py-32`}>
            <div className="max-w-7xl mx-auto text-center">
              <div className="h-10 w-48 bg-silicon-slate/20 mx-auto rounded-full animate-pulse" />
            </div>
          </section>
        )}
      </>
    )
  }

  return (
    <>
      {showProducts && (
      /* Products (digital) */
      <section id="products" className={`${SECTION_BG} ${PRODUCTS_SECTION_BG}`}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_78%_0%,rgba(212,175,55,0.14),transparent_58%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(18,30,49,0.05)_0%,rgba(244,246,250,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(5,9,15,0.16)_0%,rgba(18,30,49,0)_100%)]"
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20 animate-fade-in-up">
            <div className="pill-badge mx-auto mb-6 border-radiant-gold/25 bg-white/80 dark:border-radiant-gold/20 dark:bg-silicon-slate/30">
              <ShoppingBag className="w-3 h-3 text-radiant-gold" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                Products
              </span>
            </div>
            <h2 className="font-premium text-4xl md:text-6xl text-foreground mb-6">
              <span className="italic text-radiant-gold">Products</span>
            </h2>
            <p className="mx-auto max-w-2xl font-body text-lg text-[#475569] dark:text-muted-foreground/90">
              Ebooks, templates, calculators, and digital products to elevate your workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {digitalProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onClick={() => handleProductClick(product.id)}
                ctaLabel="View Product"
              />
            ))}
          </div>

          {(digitalProducts.length > 0 || (section === 'all' && merchandise.length > 0)) && (
            <div className="text-center mt-20 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/store"
                className="inline-flex items-center gap-4 border-b border-[#121E31]/[0.12] pb-2 font-heading text-[10px] uppercase tracking-[0.3em] text-[#475569] transition-colors hover:text-radiant-gold dark:border-foreground/10 dark:text-muted-foreground"
              >
                <span>Browse all products</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-4 border-b border-[#121E31]/[0.12] pb-2 font-heading text-[10px] uppercase tracking-[0.3em] text-[#475569] transition-colors hover:text-radiant-gold dark:border-foreground/10 dark:text-muted-foreground"
              >
                <span>See Pricing &amp; Packages</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>
      )}

      {showMerchandise && (
      <section id="merchandise" className={`${SECTION_BG} ${MERCHANDISE_BG} py-32`}>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20 animate-fade-in-up">
            <div className="pill-badge bg-background/50 border-radiant-gold/20 mb-6 mx-auto">
              <Package className="w-3 h-3 text-radiant-gold" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                Merchandise
              </span>
            </div>
            <h2 className="font-premium text-4xl md:text-6xl text-foreground mb-6">
              <span className="italic text-radiant-gold">Merchandise</span>
            </h2>
            <p className="font-body text-muted-foreground/90 text-lg max-w-2xl mx-auto">
              Premium apparel and physical goods—wear the brand.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {merchandise.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                index={index}
                onClick={() => handleProductClick(product.id)}
                ctaLabel="View Options"
              />
            ))}
          </div>

          {merchandise.length > 0 && (
            <div className="text-center mt-20">
              <Link
                href="/store"
                className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-muted-foreground hover:text-radiant-gold transition-colors pb-2 border-b border-foreground/10"
              >
                <span>Browse merchandise</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </section>
      )}
    </>
  )
}
