import type { CaptionSize } from '@/lib/caption-size-preference'
import styles from './captions.module.css'

const sizes: { value: CaptionSize; label: string }[] = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
]

export function CaptionSizeControl({ size, onChange }: { size: CaptionSize; onChange: (size: CaptionSize) => void }) {
  return <div className={styles.control} role="group" aria-label="Caption size">
    <span aria-hidden="true">Size</span>
    {sizes.map((option) => <button key={option.value} type="button" aria-label={`${option.label} captions`} aria-pressed={size === option.value} onClick={() => onChange(option.value)}>{option.value}</button>)}
  </div>
}
