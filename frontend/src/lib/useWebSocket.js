import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_URL, getAccessToken, refreshAccessToken } from './axios'

// Must match WS_CLOSE_UNAUTHORIZED in backend/app/api/ws.py.
const WS_CLOSE_UNAUTHORIZED = 4401
const HEARTBEAT_INTERVAL_MS = 25_000
const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/**
 * Authenticated WebSocket connection to /api/ws.
 *
 * The in-memory access token is sent as the first message (never in the URL). Drops are
 * retried with exponential backoff + jitter; a 4401 close triggers one token refresh first.
 *
 * status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
 */
export function useWebSocket({ enabled = true, onMessage } = {}) {
  const [status, setStatus] = useState('idle')
  const [lastMessage, setLastMessage] = useState(null)
  const socketRef = useRef(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (!enabled) return undefined

    let disposed = false
    let attempts = 0
    let refreshedAfterRejection = false
    let retryTimer = null
    let heartbeatTimer = null

    function scheduleReconnect() {
      const backoff = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** attempts)
      attempts += 1
      setStatus('reconnecting')
      retryTimer = setTimeout(connect, backoff / 2 + Math.random() * (backoff / 2))
    }

    function connect() {
      clearTimeout(retryTimer)
      if (disposed) return

      const token = getAccessToken()
      if (!token) {
        setStatus('disconnected')
        return
      }

      setStatus(attempts === 0 ? 'connecting' : 'reconnecting')
      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }))

      socket.onmessage = (event) => {
        let message
        try {
          message = JSON.parse(event.data)
        } catch {
          return
        }
        if (message.type === 'connected') {
          attempts = 0
          refreshedAfterRejection = false
          setStatus('connected')
          heartbeatTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }))
          }, HEARTBEAT_INTERVAL_MS)
        }
        setLastMessage(message)
        onMessageRef.current?.(message)
      }

      socket.onclose = (event) => {
        clearInterval(heartbeatTimer)
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) return

        if (event.code === WS_CLOSE_UNAUTHORIZED && !refreshedAfterRejection) {
          refreshedAfterRejection = true
          setStatus('reconnecting')
          refreshAccessToken().then(connect, () => setStatus('disconnected'))
          return
        }
        scheduleReconnect()
      }
    }

    // Skip the remaining backoff as soon as the network comes back.
    function handleOnline() {
      if (!socketRef.current) {
        attempts = 0
        connect()
      }
    }

    connect()
    window.addEventListener('online', handleOnline)

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      clearInterval(heartbeatTimer)
      window.removeEventListener('online', handleOnline)
      const socket = socketRef.current
      socketRef.current = null
      if (socket?.readyState === WebSocket.CONNECTING) {
        // Closing mid-handshake logs a browser warning (common under StrictMode); close once open.
        socket.onopen = () => socket.close(1000)
      } else {
        socket?.close(1000)
      }
      setStatus('idle')
    }
  }, [enabled])

  const send = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(message))
    return true
  }, [])

  return { status: enabled ? status : 'idle', lastMessage, send }
}
