import { useEffect, useRef } from 'react'
import type { BattleFrame } from '../hooks/useBattle'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAP_SIZE   = 45
const CELL_SIZE  = 10
const CANVAS_PX  = MAP_SIZE * CELL_SIZE   // 450

const EMPTY_BG        = '#0d1117'
const GRID_LINE_COLOR = 'rgba(255,255,255,0.04)'

const RED_RGB  = { r: 220, g: 60,  b: 60  }
const BLUE_RGB = { r: 55,  g: 138, b: 221 }

// ---------------------------------------------------------------------------
// Draw helpers (called from rAF loop — no React state touched)
// ---------------------------------------------------------------------------

function drawFrame(ctx: CanvasRenderingContext2D, frame: BattleFrame | null): void {
  // Background
  ctx.fillStyle = EMPTY_BG
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX)

  if (frame && Array.isArray(frame.team)) {
    const { team } = frame
    for (let row = 0; row < MAP_SIZE; row++) {
      const rowData = team[row]
      if (!rowData) continue
      for (let col = 0; col < MAP_SIZE; col++) {
        const t = rowData[col]
        if (t === 0) continue
        const c = t === 1 ? RED_RGB : BLUE_RGB
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`
        ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      }
    }
  }

  // Grid lines (drawn last so they sit on top of cells)
  ctx.strokeStyle = GRID_LINE_COLOR
  ctx.lineWidth   = 0.5
  for (let i = 0; i <= MAP_SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0);      ctx.lineTo(i * CELL_SIZE, CANVAS_PX); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE);      ctx.lineTo(CANVAS_PX, i * CELL_SIZE); ctx.stroke()
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BattleCanvasProps {
  frame: BattleFrame | null
  isConnecting: boolean
}

export function BattleCanvas({ frame, isConnecting }: BattleCanvasProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  // Keep a ref so the rAF callback always sees the latest frame without
  // triggering effect teardown/restart on every frame change.
  const frameRef   = useRef<BattleFrame | null>(null)
  const drawnRef   = useRef<BattleFrame | null>(undefined as unknown as BattleFrame | null)

  // Sync prop → ref
  useEffect(() => { frameRef.current = frame }, [frame])

  // Single rAF loop — mounted once, never restarted
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number
    const tick = () => {
      const current = frameRef.current
      // Only re-draw when the frame reference changed
      if (current !== drawnRef.current) {
        drawnRef.current = current
        drawFrame(ctx, current)
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, []) // intentionally empty — runs once on mount

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        width={CANVAS_PX}
        height={CANVAS_PX}
        className="block border border-gray-800 rounded"
      />

      {/* "Simulating…" spinner — shown while WS is open but no frames yet */}
      {isConnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded">
          <div className="h-10 w-10 rounded-full border-2 border-transparent border-b-blue-400 animate-spin mb-3" />
          <p className="text-gray-400 text-sm tracking-wide">Simulating…</p>
        </div>
      )}
    </div>
  )
}
