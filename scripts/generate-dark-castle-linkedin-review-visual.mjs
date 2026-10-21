import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const root = process.cwd()
const sourceDir = resolve(root, 'public/review-assets/social-content/storyboard-review')
const output = resolve(root, 'public/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png')

const esc = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">${body}</svg>`)

// These are the three rights-cleared public captures bound to the October 14
// Dark Castle source map. The customer-facing image contains their pixels only;
// receipts and release boundaries live in the separate review packet.
const position = await sharp(resolve(sourceDir, 'explore-position.jpg'))
  .extract({ left: 132, top: 0, width: 1090, height: 960 })
  .resize(1050, 925, { fit: 'cover', position: 'top' })
  .png().toBuffer()
const response = await sharp(resolve(sourceDir, 'explore-computer.jpg'))
  .extract({ left: 920, top: 48, width: 304, height: 575 })
  .resize(350, 662, { fit: 'cover', position: 'top' })
  .png().toBuffer()
const logo = await sharp(resolve(root, 'public/amadutown-logo-upscaled.png'))
  .resize({ height: 76 })
  .png().toBuffer()

const base = await sharp({ create: { width: 1200, height: 1500, channels: 4, background: '#081522' } })
  .composite([
    { input: position, left: 75, top: 348 },
    { input: response, left: 766, top: 615 },
    { input: logo, left: 1050, top: 48 },
  ])
  .png().toBuffer()

const overlay = svg(`
  <rect width="1200" height="1500" fill="none"/>
  <rect x="75" y="67" width="10" height="36" rx="5" fill="#E9B95A"/>
  <text x="107" y="92" fill="#E9B95A" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="25" font-weight="700" letter-spacing="3">DARK CASTLE CHESS</text>
  <text x="75" y="176" fill="#F8F5EE" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="63" font-weight="700">A right move can be</text>
  <text x="75" y="251" fill="#F8F5EE" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="63" font-weight="700">an accident.</text>
  <text x="75" y="307" fill="#AFC1CB" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="28">Keep the position and response in view.</text>
  <rect x="75" y="348" width="1050" height="925" rx="17" fill="none" stroke="#D5C0A3" stroke-width="3"/>
  <rect x="75" y="348" width="1050" height="925" rx="17" fill="#081522" opacity=".01"/>
  <rect x="75" y="1012" width="650" height="261" fill="#081522" opacity=".93"/>
  <rect x="75" y="1012" width="650" height="261" fill="none" stroke="#D5C0A3" stroke-width="2"/>
  <text x="106" y="1067" fill="#E9B95A" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="23" font-weight="700" letter-spacing="2">01 / EXPLORE</text>
  <text x="106" y="1129" fill="#F8F5EE" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="39" font-weight="700">See the board</text>
  <text x="106" y="1173" fill="#C7D2D7" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="25">A move has a position behind it.</text>
  <text x="106" y="1214" fill="#C7D2D7" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="25">Here, the line and notation stay visible.</text>
  <rect x="748" y="557" width="394" height="45" rx="8" fill="#102439"/>
  <text x="770" y="587" fill="#E9B95A" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="23" font-weight="700" letter-spacing="2">02 / RESPOND</text>
  <rect x="748" y="593" width="394" height="697" rx="18" fill="none" stroke="#E9B95A" stroke-width="3"/>
  <rect x="75" y="1320" width="1050" height="2" fill="#365066"/>
  <text x="75" y="1380" fill="#F8F5EE" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="30" font-weight="700">Product design test</text>
  <text x="75" y="1426" fill="#B9C9D0" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="27">After the response, can the player explain the next choice?</text>
  <text x="75" y="1470" fill="#E9B95A" font-family="Avenir Next, Helvetica Neue, sans-serif" font-size="18" font-weight="700" letter-spacing="1.4">AMADUTOWN ADVISORY SOLUTIONS</text>
`)

await sharp(base).composite([{ input: overlay, left: 0, top: 0 }]).png({ compressionLevel: 9 }).toFile(output)
console.log(output)
