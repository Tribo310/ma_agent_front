import type { BattleFrame } from '../hooks/useBattle'

const MAX_AGENTS = 81
const MAX_TICKS  = 500

interface StatsBarProps {
  frame: BattleFrame | null
}

export function StatsBar({ frame }: StatsBarProps) {
  if (!frame) return null

  const { tick, red_alive, blue_alive } = frame
  const redPct  = Math.round((red_alive  / MAX_AGENTS) * 100)
  const bluePct = Math.round((blue_alive / MAX_AGENTS) * 100)
  const tickPct = Math.round((tick       / MAX_TICKS)  * 100)

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-3 select-none">
      {/* Agent counts + tick */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold text-xl tabular-nums">{red_alive}</span>
          <span className="text-gray-600 text-xs uppercase tracking-widest">Red</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-gray-300 font-mono text-xs">
            tick {String(tick).padStart(3, '0')} / {MAX_TICKS}
          </span>
          <div className="h-1 w-28 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full bg-gray-400 rounded transition-all duration-100"
              style={{ width: `${tickPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs uppercase tracking-widest">Blue</span>
          <span className="text-blue-400 font-bold text-xl tabular-nums">{blue_alive}</span>
        </div>
      </div>

      {/* HP / population bars */}
      <div className="flex gap-1 h-2">
        <div className="flex-1 bg-gray-800 rounded-l overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-l transition-all duration-100"
            style={{ width: `${redPct}%` }}
          />
        </div>
        <div className="flex-1 bg-gray-800 rounded-r overflow-hidden flex justify-end">
          <div
            className="h-full bg-blue-500 rounded-r transition-all duration-100"
            style={{ width: `${bluePct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
