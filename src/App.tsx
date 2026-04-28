import { useState, useEffect, useCallback } from 'react'
import { UploadPanel } from './components/UploadPanel'
import { BattleCanvas } from './components/BattleCanvas'
import { StatsBar }     from './components/StatsBar'
import { BattleLog }    from './components/BattleLog'
import { useBattle }    from './hooks/useBattle'
import type { Winner }  from './hooks/useBattle'

const API_URL = (import.meta.env.VITE_API_URL as string).replace(/\/$/, '')

interface ReadyState { ready: boolean; red: boolean; blue: boolean }

export default function App() {
  const [readyState, setReadyState]   = useState<ReadyState>({ ready: false, red: false, blue: false })
  const [polling,    setPolling]      = useState(false)
  const [speed,      setSpeedVal]     = useState(1)
  // Local overlay state so the user can dismiss it without fully resetting
  const [showOverlay, setShowOverlay] = useState(false)
  const [lastWinner,  setLastWinner]  = useState<Winner>(null)

  const {
    currentFrame,
    isRunning,
    isConnecting,
    winner,
    log,
    error,
    startBattle,
    stopBattle,
    setSpeed,
  } = useBattle()

  // Show overlay whenever a new winner arrives
  useEffect(() => {
    if (winner !== null) {
      setLastWinner(winner)
      setShowOverlay(true)
    }
  }, [winner])

  // ---- /ready polling -------------------------------------------------------

  const pollReady = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/ready`)
      if (res.ok) setReadyState(await res.json() as ReadyState)
    } catch { /* backend not yet reachable */ }
  }, [])

  useEffect(() => {
    if (!polling) return
    void pollReady()
    const id = setInterval(() => void pollReady(), 2000)
    return () => clearInterval(id)
  }, [polling, pollReady])

  // ---- handlers -------------------------------------------------------------

  const handleUploadComplete = () => setPolling(true)

  const handleStart = () => {
    setShowOverlay(false)
    startBattle(speed)
  }

  const handleSpeedChange = (v: number) => {
    setSpeedVal(v)
    setSpeed(v)
  }

  const handleReset = () => {
    stopBattle()
    setShowOverlay(false)
    setLastWinner(null)
    setReadyState({ ready: false, red: false, blue: false })
    setPolling(false)
  }

  const handleDismissOverlay = () => setShowOverlay(false)

  // ---- derived -------------------------------------------------------

  const canStart = readyState.ready && !isRunning && !isConnecting

  const overlayStyle: React.CSSProperties = {
    backgroundColor:
      lastWinner === 'red'  ? 'rgba(180,30,30,0.82)'  :
      lastWinner === 'blue' ? 'rgba(30,90,200,0.82)'  :
                              'rgba(60,60,60,0.82)',
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200 p-4 md:p-6">
      {/* Title */}
      <h1 className="text-center text-2xl font-bold tracking-widest text-gray-100 mb-5 uppercase">
        MAgent2 · Battle Arena
      </h1>

      {/* Stats bar — only once a battle is underway */}
      {(isRunning || isConnecting || winner !== null) && (
        <div className="max-w-[530px] mx-auto mb-4">
          <StatsBar frame={currentFrame} />
        </div>
      )}

      {/* Main row: upload ← canvas → upload */}
      <div className="flex gap-4 justify-center items-start flex-wrap">

        {/* Red upload */}
        <div className="w-44 shrink-0">
          <UploadPanel team="red" playerLabel="Player 1 — Red" onReady={handleUploadComplete} />
          {readyState.red && !readyState.blue && (
            <p className="text-gray-700 text-[10px] text-center mt-2">Waiting for Blue…</p>
          )}
        </div>

        {/* Canvas + controls */}
        <div className="flex flex-col items-center gap-3">
          <BattleCanvas frame={currentFrame} isConnecting={isConnecting} />

          {/* Control row */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`px-5 py-2 rounded font-semibold text-sm transition-colors ${
                canStart
                  ? 'bg-green-700 hover:bg-green-600 text-white cursor-pointer'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              {isConnecting ? 'Connecting…' : isRunning ? 'Running…' : 'Start Battle'}
            </button>

            {(isRunning || winner !== null || error) && (
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded text-sm border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Reset
              </button>
            )}

            <label className="flex items-center gap-2 text-gray-500 text-xs">
              Speed
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={speed}
                onChange={e => handleSpeedChange(Number(e.target.value))}
                className="w-24 accent-gray-400"
              />
              <span className="w-7 text-gray-300 tabular-nums">{speed}×</span>
            </label>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-950 border border-red-800 rounded p-3 text-red-400 text-xs w-full max-w-[450px] flex items-center justify-between gap-3">
              <span>{error}</span>
              <button onClick={handleStart} className="underline hover:text-red-300 shrink-0">
                Reconnect
              </button>
            </div>
          )}
        </div>

        {/* Blue upload */}
        <div className="w-44 shrink-0">
          <UploadPanel team="blue" playerLabel="Player 2 — Blue" onReady={handleUploadComplete} />
          {readyState.blue && !readyState.red && (
            <p className="text-gray-700 text-[10px] text-center mt-2">Waiting for Red…</p>
          )}
        </div>
      </div>

      {/* Battle log */}
      <div className="max-w-[530px] mx-auto mt-5">
        <BattleLog log={log} />
      </div>

      {/* Winner overlay */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
          style={overlayStyle}
          onClick={handleDismissOverlay}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleDismissOverlay() }}
          aria-label="Dismiss winner overlay"
        >
          <p className="text-7xl font-black text-white drop-shadow-lg mb-4 tracking-wide select-none">
            {lastWinner === 'draw' ? 'DRAW' : `${lastWinner!.toUpperCase()} WINS`}
          </p>
          <p className="text-white/70 text-lg select-none">Click anywhere to dismiss</p>
        </div>
      )}
    </div>
  )
}
