import type { LayerKey } from '../types'

const items: { key: LayerKey; label: string; color: string; shape: string }[] = [
  { key: 'disaster', label: 'Disasters', color: '#ff2222', shape: 'circle' },
  { key: 'conflict', label: 'Conflicts', color: '#00eeff', shape: 'diamond' },
  { key: 'cyber', label: 'Cyber Attacks', color: '#ff44ff', shape: 'triangle' },
]

function ShapeIcon({ color, shape }: { color: string; shape: string }) {
  if (shape === 'diamond') {
    return (
      <span
        className="inline-block"
        style={{
          width: 10, height: 10, background: color,
          transform: 'rotate(45deg)',
          border: '2px solid rgba(255,255,255,0.9)',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    )
  }
  if (shape === 'triangle') {
    return (
      <span
        className="inline-block"
        style={{
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: `10px solid ${color}`,
          filter: `drop-shadow(0 0 3px ${color})`,
        }}
      />
    )
  }
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 10, height: 10, background: color,
        border: '2px solid rgba(255,255,255,0.9)',
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  )
}

export default function Legend() {
  return (
    <div className="flex gap-4 text-xs">
      {items.map(item => (
        <div key={item.key} className="flex items-center gap-1.5">
          <ShapeIcon color={item.color} shape={item.shape} />
          <span className="text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
