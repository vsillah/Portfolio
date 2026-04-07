'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, Plus, X, Loader2 } from 'lucide-react'

export interface AssetPickerItem {
  asset_id: string
  asset_name: string
  is_favorite: boolean
  is_default: boolean
  metadata?: Record<string, unknown>
}

export default function AssetPicker({
  label,
  items,
  selectedId,
  onSelect,
  onToggleFavorite,
  onAddManual,
  onSetDefault,
}: {
  label: string
  items: AssetPickerItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleFavorite: (id: string, fav: boolean) => void
  onAddManual?: (id: string, name: string) => Promise<void>
  onSetDefault?: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [addId, setAddId] = useState('')
  const [addName, setAddName] = useState('')
  const [adding, setAdding] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (open && !addMode) inputRef.current?.focus()
  }, [open, addMode])

  const selected = items.find(i => i.asset_id === selectedId)
  const systemDefault = items.find(i => i.is_default)
  const favItems = items.filter(i => i.is_favorite)
  const pool = showAll ? items : favItems
  const filtered = search
    ? pool.filter(i => i.asset_name.toLowerCase().includes(search.toLowerCase()))
    : pool

  async function handleAdd() {
    if (!onAddManual || !addId.trim()) return
    setAdding(true)
    await onAddManual(addId.trim(), addName.trim() || addId.trim())
    setAddId('')
    setAddName('')
    setAddMode(false)
    setAdding(false)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      <label className="text-[10px] text-gray-400 font-medium mb-1 block">{label}</label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setAddMode(false) }}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-background/50 border border-silicon-slate text-foreground hover:border-gray-500 focus:border-radiant-gold/50 focus:outline-none transition-colors"
      >
        <span className="truncate">
          {selected ? (
            <>
              {selected.is_favorite ? '★ ' : ''}{selected.asset_name}
              {selected.is_default && <span className="text-gray-500 ml-1 text-[9px]">(default)</span>}
            </>
          ) : (
            <span className="text-gray-500">
              {systemDefault ? `${systemDefault.asset_name} (default)` : `Select ${label.toLowerCase()}…`}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3 h-3 ml-2 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-silicon-slate bg-[#0d1117] shadow-xl max-h-72 flex flex-col">
          {!addMode ? (
            <>
              {/* Search + filter bar */}
              <div className="flex items-center gap-2 px-2 pt-2 pb-1 border-b border-silicon-slate/50">
                <Search className="w-3 h-3 text-gray-500 shrink-0" />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${label.toLowerCase()}s…`}
                  className="flex-1 bg-transparent text-xs text-foreground placeholder:text-gray-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className={`text-[9px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${showAll ? 'border-silicon-slate text-gray-500 hover:text-foreground' : 'border-amber-500/50 bg-amber-500/10 text-amber-400'}`}
                >
                  {showAll ? 'All' : '★ Favs'}
                </button>
              </div>

              {/* Options */}
              <div className="overflow-y-auto flex-1 py-1">
                {filtered.length === 0 && (
                  <p className="text-[10px] text-gray-500 px-3 py-2">
                    {search ? 'No matches found' : showAll ? 'No items synced' : 'No favorites — toggle to All'}
                  </p>
                )}
                {filtered.map(item => (
                  <div
                    key={item.asset_id}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                      item.asset_id === selectedId
                        ? 'bg-radiant-gold/10 text-radiant-gold'
                        : 'text-foreground hover:bg-white/5'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.asset_id, !item.is_favorite) }}
                      className={`shrink-0 text-xs transition-colors ${item.is_favorite ? 'text-amber-400 hover:text-amber-300' : 'text-gray-600 hover:text-amber-400'}`}
                      title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {item.is_favorite ? '★' : '☆'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { onSelect(item.asset_id); setOpen(false); setSearch('') }}
                      className="flex-1 text-left truncate"
                    >
                      {item.asset_name}
                      {item.metadata?.language ? <span className="text-gray-500 ml-1">({String(item.metadata.language)})</span> : null}
                    </button>

                    {item.is_default && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">default</span>
                    )}
                    {item.asset_id === selectedId && !item.is_default && (
                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-radiant-gold/20 text-radiant-gold font-medium">selected</span>
                    )}
                    {onSetDefault && !item.is_default && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSetDefault(item.asset_id) }}
                        className="shrink-0 text-[9px] text-gray-600 hover:text-emerald-400 transition-colors"
                        title="Set as system default"
                      >
                        Set default
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-3 py-1.5 border-t border-silicon-slate/50 flex items-center justify-between">
                <span className="text-[9px] text-gray-600">
                  {filtered.length} of {items.length} · {favItems.length} fav{favItems.length !== 1 ? 's' : ''}
                </span>
                {onAddManual && (
                  <button
                    type="button"
                    onClick={() => setAddMode(true)}
                    className="text-[9px] text-gray-500 hover:text-radiant-gold transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" /> Add by ID
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-medium">Add {label.toLowerCase()} by ID</span>
                <button type="button" onClick={() => setAddMode(false)} className="text-gray-500 hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                value={addId}
                onChange={e => setAddId(e.target.value)}
                placeholder={`${label} ID`}
                autoFocus
                className="w-full px-2 py-1.5 rounded text-xs bg-background/50 border border-silicon-slate text-foreground focus:border-radiant-gold/50 focus:outline-none"
              />
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full px-2 py-1.5 rounded text-xs bg-background/50 border border-silicon-slate text-foreground focus:border-radiant-gold/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={!addId.trim() || adding}
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-radiant-gold/15 text-radiant-gold font-medium hover:bg-radiant-gold/25 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {adding ? 'Adding…' : `Add ${label.toLowerCase()}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
