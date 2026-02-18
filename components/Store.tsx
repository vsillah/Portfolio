'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, ArrowRight, ShoppingCart, Package } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/types/store'
import { formatPriceOrFree } from '@/lib/pricing-model'

const TYPE_LABELS: Record<string, string> = {
  ebook: 'E-Book',
  training: 'Training',
  calculator: 'Calculator',
  music: 'Music',
  app: 'App',
  merchandise: 'Merchandise',
  template: 'Template',
}

const SECTION_BG = 'py-32 px-6 sm:px-10 lg:px-12 relative overflow-hidden'
const PRODUCTS_BG = 'bg-silicon-slate/10'
const MERCHANDISE_BG = 'bg-imperial-navy/20'

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onClick={onClick}
      className="group relative bg-silicon-slate/40 backdrop-blur-md rounded-2xl overflow-hidden border border-radiant-gold/5 hover:border-radiant-gold/20 transition-all duration-500 cursor-pointer"
    >
      <div className="relative h-64 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-imperial-navy">
            <ShoppingBag className="text-radiant-gold/20" size={48} />
          </div>
        )}
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          <span className="px-3 py-1 bg-imperial-navy/80 backdrop-blur-md border border-radiant-gold/20 rounded-full text-[10px] font-heading tracking-widest text-radiant-gold uppercase">
            {TYPE_LABELS[product.type] || product.type}
          </span>
          {product.is_featured && (
            <span className="px-3 py-1 bg-radiant-gold text-imperial-navy rounded-full text-[10px] font-heading tracking-widest uppercase font-bold">
              Featured
            </span>
          )}
        </div>
        <div className="absolute bottom-6 right-6 px-4 py-2 bg-imperial-navy/90 backdrop-blur-md border border-radiant-gold/20 rounded-full text-radiant-gold text-sm font-heading tracking-tighter">
          {formatPriceOrFree(product.price ?? 0)}
        </div>
      </div>
      <div className="p-8">
        <h3 className="font-premium text-2xl text-platinum-white group-hover:text-radiant-gold transition-colors mb-3">
          {product.title}
        </h3>
        {product.description && (
          <p className="font-body text-platinum-white/50 text-sm line-clamp-2 mb-8">
            {product.description}
          </p>
        )}
        <div className="w-full flex items-center justify-center gap-3 py-3 border border-radiant-gold/20 group-hover:bg-radiant-gold group-hover:text-imperial-navy rounded-full transition-all duration-300">
          <ShoppingCart size={14} />
          <span className="text-[10px] font-heading tracking-widest uppercase">{ctaLabel}</span>
        </div>
      </div>
    </motion.div>
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
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?active=true')
        if (response.ok) {
          const data = await response.json()
          setAllProducts(data || [])
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
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
          <section id="products" className={`${SECTION_BG} ${PRODUCTS_BG}`}>
            <div className="max-w-7xl mx-auto text-center">
              <div className="h-10 w-48 bg-silicon-slate/20 mx-auto rounded-full animate-pulse" />
            </div>
          </section>
        )}
        {showMerchandise && (
          <section id="merchandise" className={`${SECTION_BG} ${MERCHANDISE_BG}`}>
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
      <section id="products" className={`${SECTION_BG} ${PRODUCTS_BG}`}>
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <div className="pill-badge bg-silicon-slate/30 border-radiant-gold/20 mb-6 mx-auto">
              <ShoppingBag className="w-3 h-3 text-radiant-gold" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                Products
              </span>
            </div>
            <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
              <span className="italic text-radiant-gold">Products</span>
            </h2>
            <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto">
              Ebooks, templates, calculators, and digital products to elevate your workflow.
            </p>
          </motion.div>

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
                className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors pb-2 border-b border-platinum-white/10"
              >
                <span>Browse all products</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors pb-2 border-b border-platinum-white/10"
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
      <section id="merchandise" className={`${SECTION_BG} ${MERCHANDISE_BG}`}>
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <div className="pill-badge bg-imperial-navy/50 border-radiant-gold/20 mb-6 mx-auto">
              <Package className="w-3 h-3 text-radiant-gold" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-heading text-radiant-gold">
                Merchandise
              </span>
            </div>
            <h2 className="font-premium text-4xl md:text-6xl text-platinum-white mb-6">
              <span className="italic text-radiant-gold">Merchandise</span>
            </h2>
            <p className="font-body text-platinum-white/50 text-lg max-w-2xl mx-auto">
              Premium apparel and physical goods—wear the brand.
            </p>
          </motion.div>

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
                className="inline-flex items-center gap-4 text-[10px] font-heading tracking-[0.3em] uppercase text-platinum-white/60 hover:text-radiant-gold transition-colors pb-2 border-b border-platinum-white/10"
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
