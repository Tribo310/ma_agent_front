import { useEffect, useRef } from 'react'
import type { LogEntry } from '../hooks/useBattle'

interface BattleLogProps {
  log: LogEntry[]
}

export function BattleLog({ log }: BattleLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 h-44 overflow-y-auto font-mono text-xs">
      {log.length === 0 ? (
        <p className="text-gray-700 italic">No events yet — upload both models and start a battle.</p>
      ) : (
        log.map(entry => (
          <div key={entry.id} className="mb-0.5 leading-relaxed">
            <span className="text-gray-600 mr-2">
              [{entry.tick > 0 ? `t${String(entry.tick).padStart(3, '0')}` : '---'}]
            </span>
            <span
              className={
                entry.message.toLowerCase().includes('red')   ? 'text-red-400'   :
                entry.message.toLowerCase().includes('blue')  ? 'text-blue-400'  :
                entry.message.toLowerCase().includes('wins')  ? 'text-yellow-300 font-bold' :
                entry.message.toLowerCase().includes('draw')  ? 'text-yellow-300 font-bold' :
                'text-gray-400'
              }
            >
              {entry.message}
            </span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
