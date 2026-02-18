'use client';

import { 
  ProductWithRole, 
  ContentWithRole,
  ContentType,
  OFFER_ROLE_LABELS, 
  OFFER_ROLE_COLORS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  calculateValueScore,
} from '@/lib/sales-scripts';
import { formatCurrency } from '@/lib/pricing-model';
import { 
  Gift, 
  Star, 
  Clock, 
  Zap, 
  Check,
  Plus,
  ExternalLink,
} from 'lucide-react';

interface OfferCardProps {
  product: ProductWithRole;
  showValueEquation?: boolean;
  showAddButton?: boolean;
  onAdd?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function OfferCard({ 
  product, 
  showValueEquation = true,
  showAddButton = false,
  onAdd,
  isSelected = false,
  compact = false,
}: OfferCardProps) {
  const roleColor = product.offer_role 
    ? OFFER_ROLE_COLORS[product.offer_role] 
    : 'bg-gray-100 text-gray-600 border-gray-300';

  const valueScore = calculateValueScore(
    8, // Dream outcome
    product.likelihood_multiplier || 5,
    Math.max(10 - (product.time_reduction || 0) / 7, 1),
    Math.max(10 - (product.effort_reduction || 0), 1)
  );

  const displayPrice = product.offer_price || product.price || 0;
  const retailPrice = product.role_retail_price || product.price || 0;
  const perceivedValue = product.perceived_value || retailPrice;
  const savings = perceivedValue - displayPrice;

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 bg-white'
        }`}
      >
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.title}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
            <Gift className="w-5 h-5 text-gray-400" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">{product.title}</span>
            {product.offer_role && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleColor}`}>
                {OFFER_ROLE_LABELS[product.offer_role]}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {displayPrice === 0 ? 'Free' : formatCurrency(displayPrice)}
            {savings > 0 && (
              <span className="text-green-600 ml-2">
                ({formatCurrency(perceivedValue)} value)
              </span>
            )}
          </div>
        </div>

        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className={`p-2 rounded-lg transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`rounded-xl border overflow-hidden transition-all ${
        isSelected 
          ? 'border-blue-500 ring-2 ring-blue-200' 
          : 'border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Header with image */}
      <div className="relative">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.title}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Gift className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Role badge */}
        {product.offer_role && (
          <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-medium border ${roleColor}`}>
            {OFFER_ROLE_LABELS[product.offer_role]}
          </div>
        )}

        {/* Value score badge */}
        {showValueEquation && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/70 text-white text-xs font-medium flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            {valueScore} Value
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1">
          {product.bonus_name || product.title}
        </h3>
        
        {product.bonus_description && (
          <p className="text-sm text-gray-600 mb-3">{product.bonus_description}</p>
        )}

        {product.dream_outcome_description && (
          <p className="text-sm text-gray-600 mb-3 italic">
            &quot;{product.dream_outcome_description}&quot;
          </p>
        )}

        {/* Value equation breakdown */}
        {showValueEquation && (
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            {product.likelihood_multiplier && (
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                {product.likelihood_multiplier}/10 Success
              </div>
            )}
            {product.time_reduction && product.time_reduction > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                {product.time_reduction}d saved
              </div>
            )}
            {product.effort_reduction && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                {product.effort_reduction}/10 easier
              </div>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-end justify-between">
          <div>
            {savings > 0 && (
              <div className="text-sm text-gray-400 line-through">
                {formatCurrency(perceivedValue)} value
              </div>
            )}
            <div className="text-lg font-bold text-gray-900">
              {displayPrice === 0 ? 'FREE' : formatCurrency(displayPrice)}
            </div>
          </div>

          {savings > 0 && (
            <div className="px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded">
              Save {formatCurrency(savings)}
            </div>
          )}
        </div>

        {/* Add button */}
        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className={`w-full mt-4 py-2 rounded-lg font-medium transition-colors ${
              isSelected
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isSelected ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Added
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add to Offer
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// Component to display a stack of offers (Grand Slam Offer)
interface OfferStackProps {
  products: ProductWithRole[];
  totalPrice: number;
  totalValue: number;
}

export function OfferStack({ products, totalPrice, totalValue }: OfferStackProps) {
  const savings = totalValue - totalPrice;
  const savingsPercent = totalValue > 0 ? Math.round((savings / totalValue) * 100) : 0;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-6 text-white">
      <h3 className="text-xl font-bold mb-4">Your Grand Slam Offer</h3>
      
      <div className="space-y-3 mb-6">
        {products.map((product) => (
          <div key={product.id} className="flex items-center justify-between bg-white/10 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <Check className="w-5 h-5 text-green-400" />
              <span>{product.bonus_name || product.title}</span>
            </div>
            <span className="text-white/70">
              {formatCurrency(product.perceived_value || product.price || 0)} value
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/20 pt-4">
        <div className="flex justify-between text-lg mb-2">
          <span className="text-white/80">Total Value:</span>
          <span className="line-through text-white/60">{formatCurrency(totalValue)}</span>
        </div>
        
        <div className="flex justify-between text-2xl font-bold mb-2">
          <span>Your Price:</span>
          <span className="text-green-400">{formatCurrency(totalPrice)}</span>
        </div>

        {savings > 0 && (
          <div className="text-center mt-4 py-2 bg-green-500/20 rounded-lg">
            <span className="text-green-300 font-medium">
              You Save {formatCurrency(savings)} ({savingsPercent}% off!)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ContentOfferCard - for displaying any content type with offer classification
interface ContentOfferCardProps {
  content: ContentWithRole;
  showValueEquation?: boolean;
  showAddButton?: boolean;
  onAdd?: () => void;
  isSelected?: boolean;
  compact?: boolean;
}

export function ContentOfferCard({ 
  content, 
  showValueEquation = true,
  showAddButton = false,
  onAdd,
  isSelected = false,
  compact = false,
}: ContentOfferCardProps) {
  const roleColor = content.offer_role 
    ? OFFER_ROLE_COLORS[content.offer_role] 
    : 'bg-gray-100 text-gray-600 border-gray-300';

  const contentTypeColor = CONTENT_TYPE_COLORS[content.content_type];
  const contentTypeIcon = CONTENT_TYPE_ICONS[content.content_type];

  const valueScore = calculateValueScore(
    8, // Dream outcome
    content.likelihood_multiplier || 5,
    Math.max(10 - (content.time_reduction || 0) / 7, 1),
    Math.max(10 - (content.effort_reduction || 0), 1)
  );

  const displayPrice = content.offer_price || content.price || 0;
  const retailPrice = content.role_retail_price || content.price || 0;
  const perceivedValue = content.perceived_value || retailPrice;
  const savings = perceivedValue - displayPrice;

  if (compact) {
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
          isSelected 
            ? 'border-emerald-500 bg-emerald-500/10' 
            : 'border-gray-700 hover:border-gray-600 bg-gray-800'
        }`}
      >
        {content.image_url ? (
          <img 
            src={content.image_url} 
            alt={content.title}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center text-lg">
            {contentTypeIcon}
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate">{content.title}</span>
            {content.offer_role && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${roleColor}`}>
                {OFFER_ROLE_LABELS[content.offer_role]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`px-1.5 py-0.5 rounded text-xs ${contentTypeColor}`}>
              {CONTENT_TYPE_LABELS[content.content_type]}
            </span>
            {displayPrice > 0 && (
              <span className="text-gray-400">
                {formatCurrency(displayPrice)}
              </span>
            )}
            {savings > 0 && (
              <span className="text-green-400 text-xs">
                ({formatCurrency(perceivedValue)} value)
              </span>
            )}
          </div>
        </div>

        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className={`p-2 rounded-lg transition-colors ${
              isSelected
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isSelected ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`rounded-xl border overflow-hidden transition-all ${
        isSelected 
          ? 'border-emerald-500 ring-2 ring-emerald-500/30' 
          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
      }`}
    >
      {/* Header with image */}
      <div className="relative">
        {content.image_url ? (
          <img 
            src={content.image_url} 
            alt={content.title}
            className="w-full h-32 object-cover"
          />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <span className="text-4xl">{contentTypeIcon}</span>
          </div>
        )}
        
        {/* Content type badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded text-xs font-medium ${contentTypeColor}`}>
          {CONTENT_TYPE_LABELS[content.content_type]}
        </div>

        {/* Role badge */}
        {content.offer_role && (
          <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-medium border ${roleColor}`}>
            {OFFER_ROLE_LABELS[content.offer_role]}
          </div>
        )}

        {/* Value score badge */}
        {showValueEquation && content.offer_role && (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/70 text-white text-xs font-medium flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400" />
            {valueScore} Value
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 bg-gray-800">
        <h3 className="font-semibold text-white mb-1">
          {content.bonus_name || content.title}
        </h3>
        
        {content.bonus_description && (
          <p className="text-sm text-gray-400 mb-3">{content.bonus_description}</p>
        )}

        {content.dream_outcome_description && (
          <p className="text-sm text-gray-400 mb-3 italic">
            &quot;{content.dream_outcome_description}&quot;
          </p>
        )}

        {/* Value equation breakdown */}
        {showValueEquation && content.offer_role && (
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            {content.likelihood_multiplier && (
              <div className="flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                {content.likelihood_multiplier}/10 Success
              </div>
            )}
            {content.time_reduction && content.time_reduction > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                {content.time_reduction}d saved
              </div>
            )}
            {content.effort_reduction && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                {content.effort_reduction}/10 easier
              </div>
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-end justify-between">
          <div>
            {savings > 0 && (
              <div className="text-sm text-gray-500 line-through">
                {formatCurrency(perceivedValue)} value
              </div>
            )}
            <div className="text-lg font-bold text-white">
              {displayPrice === 0 ? 'FREE' : formatCurrency(displayPrice)}
            </div>
          </div>

          {savings > 0 && (
            <div className="px-2 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded">
              Save {formatCurrency(savings)}
            </div>
          )}
        </div>

        {/* Add button */}
        {showAddButton && onAdd && (
          <button
            onClick={onAdd}
            className={`w-full mt-4 py-2 rounded-lg font-medium transition-colors ${
              isSelected
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isSelected ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Added
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add to Offer
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
