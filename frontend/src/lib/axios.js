import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// The access token lives only in module memory. The refresh token is an HttpOnly cookie
// that JavaScript can never read; the browser attaches it to /api/auth/* requests.
let accessToken = null
let handlers = { onTokenRefreshed: null, onSessionExpired: null }
let refreshPromise = null

export function setAccessToken(token) {
  accessToken = token
}

export function setAuthHandlers(next) {
  handlers = { ...handlers, ...next }
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
})

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one
 * in-flight request so a burst of 401s triggers a single refresh.
 */
export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/api/auth/refresh', null, { skipAuthRefresh: true })
      .then(({ data }) => {
        setAccessToken(data.access_token)
        handlers.onTokenRefreshed?.(data)
        return data
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const shouldRefresh =
      error.response?.status === 401 && original && !original.skipAuthRefresh && !original._retried

    if (!shouldRefresh) {
      return Promise.reject(error)
    }

    original._retried = true
    try {
      const { access_token: token } = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      setAccessToken(null)
      handlers.onSessionExpired?.()
      return Promise.reject(error)
    }
  },
)

export default api
