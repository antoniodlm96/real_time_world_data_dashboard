const items: { key: string; label: string; color: string; shape: string }[] = [
  { key: 'disaster', label: 'Disasters', color: '#ff2222', shape: 'circle' },
  { key: 'conflict', label: 'Conflicts', color: '#00eeff', shape: 'diamond' },
  { key: 'cyber', label: 'Cyber Attacks', color: '#ff44ff', shape: 'triangle' },
  { key: 'webcam', label: 'Webcams', color: '#22d3ee', shape: 'webcam' },
  { key: 'radio', label: 'Radio', color: '#fbbf24', shape: 'radio' },
  { key: 'flights', label: 'Flights', color: '#a78bfa', shape: 'flights' },
  { key: 'fires', label: 'Fires', color: '#ff6600', shape: 'fires' },
  { key: 'weather', label: 'Weather', color: '#60a5fa', shape: 'weather' },
]

function SvgIcon(path: string, color: string, size = 10) {
  return (
    <span className="inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill={color} width={size} height={size}>
        <path d={path} />
      </svg>
    </span>
  )
}

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
  if (shape === 'webcam') {
    return SvgIcon('M12 2C9.2 2 7 4.2 7 7c0 3.5 5 10 5 10s5-6.5 5-10c0-2.8-2.2-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z', color)
  }
  if (shape === 'radio') {
    return SvgIcon('M3.24 6.15C2.46 5.64 2 4.86 2 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M3 2v20M21 2v20M8 6.15C7.46 5.64 7 4.86 7 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M8 2v20M15 2v20M14 6.15C13.46 5.64 13 4.86 13 4c0-1.1.9-2 2-2s2 .9 2 2c0 .86-.46 1.64-1.24 2.15M15 21c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2z', color)
  }
  if (shape === 'flights') {
    return SvgIcon('M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z', color)
  }
  if (shape === 'fires') {
    return SvgIcon('M12 2C9.5 5.5 6 9 6 13c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-3.5-7.5-6-11z', color)
  }
  if (shape === 'weather') {
    return SvgIcon('M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z', color)
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
