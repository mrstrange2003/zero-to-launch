import { useWebSocket } from '../lib/useWebSocket'

const STATUS = {
  connected: { label: 'Live', dot: 'bg-emerald-500', ping: true },
  connecting: { label: 'Connecting…', dot: 'bg-amber-400 motion-safe:animate-pulse' },
  reconnecting: { label: 'Reconnecting…', dot: 'bg-amber-400 motion-safe:animate-pulse' },
  disconnected: { label: 'Offline', dot: 'bg-red-500' },
  idle: { label: 'Offline', dot: 'bg-slate-400 dark:bg-slate-600' },
}

export default function ConnectionStatus() {
  const { status } = useWebSocket()
  const { label, dot, ping } = STATUS[status]

  return (
    <span
      role="status"
      title={`Realtime connection: ${label}`}
      data-status={status}
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400"
    >
      <span className="relative flex size-2.5" aria-hidden="true">
        {ping && (
          <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        )}
        <span className={`relative inline-flex size-2.5 rounded-full ${dot}`} />
      </span>
      <span className="sr-only md:not-sr-only">{label}</span>
    </span>
  )
}
