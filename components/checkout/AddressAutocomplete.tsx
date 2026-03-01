'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

/** Parsed address from Google Places selection */
export interface PlaceAddress {
  address1: string
  address2: string
  city: string
  state_code: string
  zip: string
  country_code: string
}

function getComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
  useShort = false
): string {
  const c = components.find((x) => x.types.includes(type))
  return c ? (useShort ? c.short_name : c.long_name) : ''
}

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): PlaceAddress {
  const streetNumber = getComponent(components, 'street_number')
  const route = getComponent(components, 'route')
  const address1 =
    [streetNumber, route].filter(Boolean).join(' ') ||
    getComponent(components, 'premise') ||
    ''
  const address2 =
    getComponent(components, 'subpremise') ||
    getComponent(components, 'floor') ||
    getComponent(components, 'room') ||
    ''
  const city =
    getComponent(components, 'locality') ||
    getComponent(components, 'sublocality_level_1') ||
    getComponent(components, 'administrative_area_level_2') ||
    ''
  const state = getComponent(components, 'administrative_area_level_1', true)
  const zip = getComponent(components, 'postal_code')
  const country = getComponent(components, 'country', true) || 'US'
  return {
    address1: address1.trim(),
    address2: address2.trim(),
    city: city.trim(),
    state_code: state.trim().toUpperCase().slice(0, 2),
    zip: zip.trim(),
    country_code: country.trim() || 'US',
  }
}

function parseFormattedAddress(formatted: string): PlaceAddress {
  const parts = formatted
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const address1 = parts[0] ?? ''
  const city = parts[1] ?? ''
  const stateZip = (parts[2] ?? '').trim()
  const stateZipParts = stateZip.split(/\s+/)
  const state_code =
    stateZipParts[0]?.length === 2
      ? stateZipParts[0].toUpperCase()
      : ''
  const zip = stateZipParts[1] ?? ''
  const countryRaw = parts[3] ?? ''
  const countryMap: Record<string, string> = {
    usa: 'US',
    us: 'US',
    'united states': 'US',
    canada: 'CA',
    ca: 'CA',
    uk: 'GB',
    gb: 'GB',
    'united kingdom': 'GB',
  }
  const country_code =
    countryMap[countryRaw.toLowerCase()] ??
    (countryRaw.length === 2 ? countryRaw.toUpperCase() : 'US')
  return { address1, address2: '', city, state_code, zip, country_code }
}

const SCRIPT_ID = 'google-maps-places-script'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect: (address: PlaceAddress) => void
  placeholder?: string
  className?: string
  id?: string
  countryRestriction?: string
  disabled?: boolean
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Start typing your address\u2026',
  className,
  id,
  countryRestriction,
  disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const isSelectingRef = useRef(false)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const apiKey =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '')
      : ''

  const onPlaceSelectStable = useCallback(onPlaceSelect, [onPlaceSelect])
  const onChangeStable = useCallback(onChange, [onChange])

  // Keep input DOM value in sync with parent value (for prefill / external changes)
  useEffect(() => {
    if (inputRef.current && !isSelectingRef.current) {
      inputRef.current.value = value
    }
  }, [value])

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return
    if (typeof window === 'undefined') return
    if (window.google?.maps?.places) {
      setScriptLoaded(true)
      return
    }
    if (document.getElementById(SCRIPT_ID)) {
      const check = () => {
        if (window.google?.maps?.places) setScriptLoaded(true)
        else setTimeout(check, 100)
      }
      check()
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => {}
    document.head.appendChild(script)
  }, [apiKey])

  // Init Autocomplete
  useEffect(() => {
    if (!scriptLoaded || !inputRef.current || !window.google?.maps?.places) return
    if (autocompleteRef.current) return

    const opts: google.maps.places.AutocompleteOptions = {
      types: ['address'],
      fields: ['address_components', 'formatted_address', 'place_id'],
    }
    if (countryRestriction) {
      opts.componentRestrictions = {
        country: countryRestriction
          .toLowerCase()
          .split(',')
          .map((c) => c.trim()),
      }
    }

    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      opts
    )

    const serviceDiv = document.createElement('div')
    document.body.appendChild(serviceDiv)
    const placesService = new window.google.maps.places.PlacesService(serviceDiv)

    const applyParsed = (parsed: PlaceAddress) => {
      isSelectingRef.current = true
      // Set the input DOM value to just the street line (not the full formatted address)
      if (inputRef.current) {
        inputRef.current.value = parsed.address1
      }
      onChangeStable(parsed.address1)
      onPlaceSelectStable(parsed)
      // Allow React sync again after a tick
      requestAnimationFrame(() => {
        isSelectingRef.current = false
      })
    }

    const tryFillFromPlace = (place: google.maps.places.PlaceResult) => {
      const components = place?.address_components
      if (components?.length) {
        applyParsed(parseAddressComponents(components))
        return
      }
      const fallbackFromFormatted = () => {
        const formatted = place?.formatted_address
        if (formatted) applyParsed(parseFormattedAddress(formatted))
      }
      if (!place?.place_id) {
        fallbackFromFormatted()
        return
      }
      placesService.getDetails(
        {
          placeId: place.place_id,
          fields: ['address_components', 'formatted_address'],
        },
        (result, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            result?.address_components?.length
          ) {
            applyParsed(parseAddressComponents(result.address_components))
          } else {
            fallbackFromFormatted()
          }
        }
      )
    }

    autocomplete.addListener('place_changed', () => {
      tryFillFromPlace(autocomplete.getPlace())
    })

    autocompleteRef.current = autocomplete
    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
      autocompleteRef.current = null
      if (serviceDiv.parentNode) serviceDiv.remove()
    }
  }, [scriptLoaded, countryRestriction, onPlaceSelectStable, onChangeStable])

  return (
    <input
      ref={inputRef}
      type="text"
      id={id}
      defaultValue={value}
      onChange={(e) => {
        if (!isSelectingRef.current) onChangeStable(e.target.value)
      }}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="off"
      aria-autocomplete="list"
    />
  )
}
