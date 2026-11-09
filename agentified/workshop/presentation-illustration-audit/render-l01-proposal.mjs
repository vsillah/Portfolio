#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = path.join(here, 'assets/l01-paper-source-table-v1.png')
const output = path.join(here, 'frames/l01-01-corrected-proposal.png')
const W = 1920, H = 1080
const illustration = await sharp(source).resize(1260, 710, { fit: 'cover' }).png().toBuffer()
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="1920" height="1080" fill="#071b2a"/>
  <rect x="46" y="40" width="1828" height="1000" rx="22" fill="#0c2635" stroke="#57717d" stroke-width="2"/>
  <path d="M89 104H1830" stroke="#d8ad43" stroke-width="3"/>
  <text x="92" y="80" fill="#f5eddb" font-family="Arial, sans-serif" font-size="24" font-weight="700">AMADUTOWN / AGENTIFIED</text>
  <text x="1580" y="80" fill="#d8ad43" font-family="Arial, sans-serif" font-size="21" font-weight="700">LESSON 01</text>
  <rect x="606" y="174" width="1260" height="710" rx="15" fill="#102e40" stroke="#d8ad43" stroke-width="3"/>
  <text x="102" y="310" fill="#f5eddb" font-family="Arial, sans-serif" font-size="58" font-weight="700">A suggestion</text>
  <text x="102" y="386" fill="#f5eddb" font-family="Arial, sans-serif" font-size="58" font-weight="700">needs a source.</text>
  <path d="M104 454H420" stroke="#d8ad43" stroke-width="5"/>
  <text x="105" y="780" fill="#d2dce0" font-family="Arial, sans-serif" font-size="31">Harbor Learning Circle</text>
  <rect x="100" y="1000" width="1720" height="16" rx="8" fill="#29424e"/>
  <rect x="100" y="1000" width="207" height="16" rx="8" fill="#d8ad43"/>
</svg>`
await sharp(Buffer.from(svg)).composite([{ input: illustration, left: 606, top: 174 }]).png().toFile(output)
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
writeFileSync(path.join(here, 'frames/l01-01-corrected-proposal.receipt.json'), JSON.stringify({
  source_path: path.relative(here, source), source_sha256: sha(source), output_sha256: sha(output),
  source_type: 'original project-local generated illustration', source_rights: 'user-authorized Agentified L01 remediation only',
  source_prompt_path: 'assets/l01-paper-source-table-v1.prompt.txt',
  accessibility_text: 'Three paper source notes for attendance, facilitator availability, and room capacity connect to a proposed brief through a visible gold evidence trail.',
  scene_id: 'L01-01', representative_timestamp_seconds: 37,
}, null, 2) + '\n')
console.log(`${output}\nsha256=${sha(output)}`)
