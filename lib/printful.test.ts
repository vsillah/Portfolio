import { describe, expect, it } from 'vitest'
import {
  calculatePriceWithMarkup,
  mapProductTypeToCategory,
  parsePrintfulPrice,
} from './printful'

describe('parsePrintfulPrice', () => {
  it('parses numeric strings and treats invalid input as 0', () => {
    expect(parsePrintfulPrice('19.99')).toBe(19.99)
    expect(parsePrintfulPrice('0')).toBe(0)
    expect(parsePrintfulPrice('not-a-price')).toBe(0)
    expect(parsePrintfulPrice('')).toBe(0)
  })
})

describe('calculatePriceWithMarkup', () => {
  it('applies percentage markup to the base Printful cost', () => {
    expect(calculatePriceWithMarkup(20, 50)).toBe(30)
    expect(calculatePriceWithMarkup(10, 0)).toBe(10)
    expect(calculatePriceWithMarkup(8.5, 100)).toBe(17)
  })
})

describe('mapProductTypeToCategory', () => {
  it('maps apparel, houseware, travel, and office types', () => {
    expect(mapProductTypeToCategory('Unisex Hoodie')).toBe('apparel')
    expect(mapProductTypeToCategory('Ceramic Mug')).toBe('houseware')
    expect(mapProductTypeToCategory('Canvas Tote Bag')).toBe('travel')
    expect(mapProductTypeToCategory('Sticker Sheet')).toBe('office')
  })

  it('defaults unrecognized product types to apparel', () => {
    expect(mapProductTypeToCategory('Poster')).toBe('apparel')
  })
})
