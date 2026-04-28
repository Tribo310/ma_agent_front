import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'

const API_URL = import.meta.env.VITE_API_URL as string

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadPanelProps {
  team: 'red' | 'blue'
  playerLabel: string
  onReady: () => void
}

export function UploadPanel({ team, playerLabel, onReady }: UploadPanelProps) {
  const [status,    setStatus]    = useState<UploadStatus>('idle')
  const [progress,  setProgress]  = useState(0)
  const [fileName,  setFileName]  = useState<string | null>(null)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)
  const [isDragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isRed  = team === 'red'
  const border = isDragOver
    ? (isRed ? 'border-red-400'  : 'border-blue-400')
    : (isRed ? 'border-red-800'  : 'border-blue-800')
  const label  = isRed ? 'text-red-400' : 'text-blue-400'
  const bar    = isRed ? 'bg-red-500'   : 'bg-blue-500'

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.pt') && !file.name.endsWith('.pth')) {
      setErrorMsg('File must be .pt or .pth')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('uploading')
    setProgress(0)
    setErrorMsg(null)

    const body = new FormData()
    body.append('file', file)

    // Fake incremental progress (fetch has no upload progress API)
    const fakeProgress = window.setInterval(() => {
      setProgress(p => Math.min(p + 15, 85))
    }, 120)

    try {
      const res = await fetch(`${API_URL}/upload/${team}`, { method: 'POST', body })
      clearInterval(fakeProgress)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error((err as { detail?: string }).detail ?? 'Upload failed')
      }

      setProgress(100)
      setStatus('success')
      onReady()
    } catch (err) {
      clearInterval(fakeProgress)
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setProgress(0)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so the same file can be re-uploaded
    e.target.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Upload ${team} team model`}
      className={`border-2 rounded-lg p-4 cursor-pointer select-none transition-colors
        ${border}
        ${status === 'success' ? 'bg-green-950/40' : 'bg-gray-900'}
      `}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pt,.pth"
        className="hidden"
        onChange={handleChange}
      />

      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className={`font-semibold text-sm ${label}`}>{playerLabel}</span>
        {status === 'success' && (
          <span className="bg-green-800 text-green-200 text-[10px] px-2 py-0.5 rounded-full font-medium tracking-wide">
            READY
          </span>
        )}
      </div>

      {/* File name */}
      {fileName && (
        <p className="text-gray-500 text-[11px] mb-2 truncate" title={fileName}>{fileName}</p>
      )}

      {/* State-specific content */}
      {status === 'idle' && (
        <p className="text-gray-700 text-[11px] text-center py-3 leading-relaxed">
          Drop .pt / .pth here<br />or click to browse
        </p>
      )}

      {status === 'uploading' && (
        <div className="mt-1">
          <div className="h-1.5 bg-gray-800 rounded overflow-hidden">
            <div
              className={`h-full rounded transition-all duration-200 ${bar}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-600 text-[11px] mt-1">Uploading & validating…</p>
        </div>
      )}

      {status === 'success' && (
        <p className="text-green-500 text-[11px]">Model validated — ready to battle!</p>
      )}

      {status === 'error' && (
        <div className="mt-1 space-y-1">
          <p className="text-red-400 text-[11px] leading-snug">{errorMsg}</p>
          <p className="text-gray-700 text-[10px]">
            Expected input (batch,13,13,5) → output (batch,21)
          </p>
        </div>
      )}
    </div>
  )
}
