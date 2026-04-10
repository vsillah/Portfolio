import { readFileSync } from 'fs'
import { join } from 'path'

let logoBase64Cache: string | null = null
let photoBase64Cache: string | null = null

export function getLogoBase64(): string {
  if (logoBase64Cache) return logoBase64Cache
  const buf = readFileSync(join(process.cwd(), 'public', 'logo_hd.png'))
  logoBase64Cache = buf.toString('base64')
  return logoBase64Cache
}

export function getProfilePhotoBase64(): string {
  if (photoBase64Cache) return photoBase64Cache
  const buf = readFileSync(join(process.cwd(), 'public', 'Profile_Photo_1.jpg'))
  photoBase64Cache = buf.toString('base64')
  return photoBase64Cache
}
