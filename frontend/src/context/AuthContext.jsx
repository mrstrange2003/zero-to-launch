import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import api, { refreshAccessToken, setAccessToken, setAuthHandlers } from '../lib/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setAuthHandlers({
      onTokenRefreshed: (data) => setToken(data.access_token),
      onSessionExpired: () => {
        clearSession()
        toast.warning('Your session has expired. Please sign in again.', { id: 'session-expired' })
      },
    })
    return () => setAuthHandlers({ onTokenRefreshed: null, onSessionExpired: null })
  }, [clearSession])

  const fetchCurrentUser = useCallback(async () => {
    const { data } = await api.get('/api/auth/me')
    setUser(data)
    return data
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        await refreshAccessToken()
        const { data } = await api.get('/api/auth/me')
        if (!cancelled) setUser(data)
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setInitializing(false)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  const login = useCallback(
    async (email, password) => {
      const body = new URLSearchParams({ username: email, password })
      const { data } = await api.post('/api/auth/login', body, { skipAuthRefresh: true })

      // Set the module-level token first so the /me request below is authenticated.
      setAccessToken(data.access_token)
      try {
        const currentUser = await fetchCurrentUser()
        setToken(data.access_token)
        return currentUser
      } catch (error) {
        clearSession()
        throw error
      }
    },
    [fetchCurrentUser, clearSession],
  )

  const register = useCallback(async ({ email, password, fullName }) => {
    const { data } = await api.post(
      '/api/auth/register',
      { email, password, full_name: fullName || null },
      { skipAuthRefresh: true },
    )
    return data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', null, { skipAuthRefresh: true })
    } catch {
      // The local session is cleared regardless; an unreachable server must not trap the user.
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
      fetchCurrentUser,
    }),
    [token, user, login, register, logout, fetchCurrentUser],
  )

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        <span className="sr-only">Restoring session…</span>
      </div>
    )
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
