declare module 'fontkit' {
  export type FontkitPosition = {
    xAdvance: number
    yOffset: number
  }

  export type FontkitGlyph = {
    path: {
      toSVG(): string
    }
  }

  export type FontkitFont = {
    unitsPerEm: number
    getVariation(axes: Record<string, number>): FontkitFont
    layout(text: string): {
      glyphs: FontkitGlyph[]
      positions: FontkitPosition[]
    }
  }

  export function create(buffer: Uint8Array): FontkitFont
}
