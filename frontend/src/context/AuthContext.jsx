import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api, { setAccessToken, setUnauthorizedHandler } from '../lib/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const expiryTimer = useRef(null)

  const logout = useCallback(() => {
    clearTimeout(expiryTimer.current)
    setAccessToken(null)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => {
      setUnauthorizedHandler(null)
      clearTimeout(expiryTimer.current)
    }
  }, [logout])

  const fetchCurrentUser = useCallback(async () => {
    const { data } = await api.get('/api/auth/me')
    setUser(data)
    return data
  }, [])

  const login = useCallback(
    async (email, password) => {
      const body = new URLSearchParams({ username: email, password })
      const { data } = await api.post('/api/auth/login', body)

      // Set the module-level token first so the /me request below is authenticated.
      setAccessToken(data.access_token)
      try {
        const currentUser = await fetchCurrentUser()
        setToken(data.access_token)
        clearTimeout(expiryTimer.current)
        expiryTimer.current = setTimeout(logout, data.expires_in * 1000)
        return currentUser
      } catch (error) {
        logout()
        throw error
      }
    },
    [fetchCurrentUser, logout],
  )

  const register = useCallback(async ({ email, password, fullName }) => {
    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      full_name: fullName || null,
    })
    return data
  }, [])

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
