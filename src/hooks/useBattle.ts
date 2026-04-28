import { useState, useRef, useCallback, useEffect } from 'react'

// ---------------------------------------------------------------------------
// Types (exported so components can import them from here)
// ---------------------------------------------------------------------------

export interface BattleFrame {
  tick: number
  red_alive: number
  blue_alive: number
  grid: number[][]
  team: number[][]
}

export type Winner = 'red' | 'blue' | 'draw' | null

export interface LogEntry {
  id: number
  message: string
  tick: number
}

export interface UseBattleReturn {
  currentFrame: BattleFrame | null
  isRunning: boolean
  isConnecting: boolean
  winner: Winner
  log: LogEntry[]
  error: string | null
  startBattle: (speed: number) => void
  stopBattle: () => void
  setSpeed: (speed: number) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = import.meta.env.VITE_WS_URL as string
const MAX_LOG = 8
const INITIAL_TEAM_SIZE = 81

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBattle(): UseBattleReturn {
  const [currentFrame, setCurrentFrame] = useState<BattleFrame | null>(null)
  const [isRunning, setIsRunning]       = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [winner, setWinner]             = useState<Winner>(null)
  const [log, setLog]                   = useState<LogEntry[]>([])
  const [error, setError]               = useState<string | null>(null)

  // Refs that survive re-renders without stale closures
  const wsRef         = useRef<WebSocket | null>(null)
  const framesBuf     = useRef<BattleFrame[]>([])
  const intervalRef   = useRef<number | null>(null)
  const speedRef      = useRef(1)
  const isRunningRef  = useRef(false)
  const winnerRef     = useRef<Winner>(null)
  const logIdRef      = useRef(0)
  const lastRedRef    = useRef(INITIAL_TEAM_SIZE)
  const lastBlueRef   = useRef(INITIAL_TEAM_SIZE)

  // ---- log helpers ---------------------------------------------------------

  const pushLog = useCallback((message: string, tick: number) => {
    setLog(prev => [
      ...prev.slice(-(MAX_LOG - 1)),
      { id: logIdRef.current++, message, tick },
    ])
  }, [])

  // ---- render loop ---------------------------------------------------------

  const startRenderLoop = useCallback((speed: number) => {
    if (intervalRef.current !== null) clearInterval(intervalRef.current)

    // Base cadence: 10 renders/s at speed=1; up to 200/s at speed=20.
    // At high speeds we also consume multiple buffered frames per tick so
    // the simulation "fast-forwards" rather than just dropping frames.
    const intervalMs = Math.max(5, Math.round(1000 / (speed * 10)))

    intervalRef.current = window.setInterval(() => {
      if (framesBuf.current.length === 0) return

      // Consume 1 frame at low speed, more at high speed
      const consume = Math.max(1, Math.ceil(speed / 5))
      for (let i = 0; i < consume; i++) {
        const frame = framesBuf.current.shift()
        if (!frame) break

        // Kill-event log entries
        const redKills  = lastBlueRef.current - frame.blue_alive
        const blueKills = lastRedRef.current  - frame.red_alive
        if (redKills  > 0) pushLog(`Red  eliminated ${redKills}  blue ${redKills  > 1 ? 'agents' : 'agent'}`,  frame.tick)
        if (blueKills > 0) pushLog(`Blue eliminated ${blueKills} red  ${blueKills > 1 ? 'agents' : 'agent'}`, frame.tick)

        // Milestone log entries
        if (frame.tick > 0 && frame.tick % 50 === 0) {
          pushLog(`Tick ${frame.tick} — Red ${frame.red_alive} vs Blue ${frame.blue_alive}`, frame.tick)
        }

        lastRedRef.current  = frame.red_alive
        lastBlueRef.current = frame.blue_alive
        setCurrentFrame(frame)
      }
    }, intervalMs)
  }, [pushLog])

  // ---- stop ----------------------------------------------------------------

  const stopBattle = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    wsRef.current?.close()
    wsRef.current      = null
    framesBuf.current  = []
    isRunningRef.current = false
    setIsRunning(false)
    setIsConnecting(false)
  }, [])

  // ---- speed control -------------------------------------------------------

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed
    if (isRunningRef.current) startRenderLoop(speed)
  }, [startRenderLoop])

  // ---- start ---------------------------------------------------------------

  const startBattle = useCallback((speed: number) => {
    // Tear down any prior session
    stopBattle()

    speedRef.current    = speed
    framesBuf.current   = []
    lastRedRef.current  = INITIAL_TEAM_SIZE
    lastBlueRef.current = INITIAL_TEAM_SIZE
    winnerRef.current   = null
    isRunningRef.current = false

    setCurrentFrame(null)
    setIsRunning(false)
    setIsConnecting(true)
    setWinner(null)
    setError(null)
    setLog([{ id: logIdRef.current++, message: 'Connecting to battle server…', tick: 0 }])

    const ws = new WebSocket(`${WS_URL}/battle`)
    wsRef.current = ws

    ws.onopen = () => {
      setLog(prev => [
        ...prev.slice(-(MAX_LOG - 1)),
        { id: logIdRef.current++, message: 'Simulating… waiting for first frame', tick: 0 },
      ])
    }

    ws.onmessage = (ev: MessageEvent<string>) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = JSON.parse(ev.data) as any

      if ('done' in data && data.done === true) {
        const w: Winner = data.winner as Winner
        winnerRef.current  = w
        isRunningRef.current = false

        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }

        const msg = w === 'draw'
          ? 'The battle ended in a DRAW!'
          : `${w!.toUpperCase()} wins the battle!`

        setWinner(w)
        setIsRunning(false)
        setLog(prev => [...prev.slice(-(MAX_LOG - 1)), { id: logIdRef.current++, message: msg, tick: 0 }])
        return
      }

      // Server may send {"error":"..."} — surface it and bail
      if ('error' in data) {
        setError(String(data.error))
        setIsConnecting(false)
        setIsRunning(false)
        isRunningRef.current = false
        return
      }

      // Ignore any frame missing the required team grid
      if (!Array.isArray(data.team)) return

      const frame = data as BattleFrame

      // Start the render loop on the very first data frame
      if (!isRunningRef.current) {
        isRunningRef.current = true
        setIsRunning(true)
        setIsConnecting(false)
        startRenderLoop(speedRef.current)
      }

      framesBuf.current.push(frame)
    }

    ws.onerror = () => {
      setError('WebSocket error — check that the backend is reachable.')
      setIsConnecting(false)
      setIsRunning(false)
      isRunningRef.current = false
    }

    ws.onclose = (ev: CloseEvent) => {
      if (!ev.wasClean && winnerRef.current === null) {
        setError('Connection closed unexpectedly.')
        setIsRunning(false)
        setIsConnecting(false)
        isRunningRef.current = false
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }
  }, [stopBattle, startRenderLoop])

  // Cleanup on unmount
  useEffect(() => () => { stopBattle() }, [stopBattle])

  return {
    currentFrame,
    isRunning,
    isConnecting,
    winner,
    log,
    error,
    startBattle,
    stopBattle,
    setSpeed,
  }
}
