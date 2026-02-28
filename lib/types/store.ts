// Shared store types used across ProductCard, ServiceCard, Store (home), and Store page

export interface Product {
  id: number
  title: string
  description: string | null
  type: string
  price: number | null
  image_url: string | null
  is_featured: boolean
}

export interface Service {
  id: string
  title: string
  description: string | null
  service_type: string
  delivery_method: string
  duration_hours: number | null
  duration_description: string | null
  price: number | null
  is_quote_based: boolean
  min_participants: number
  max_participants: number | null
  image_url: string | null
  video_url: string | null
  video_thumbnail_url: string | null
  is_featured: boolean
}
