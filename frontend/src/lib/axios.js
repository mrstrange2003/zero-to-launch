import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// Lives only in module memory: never written to localStorage/sessionStorage/cookies.
let accessToken = null
let onUnauthorized = null

export function setAccessToken(token) {
  accessToken = token
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only a rejected *authenticated* request means our session is dead;
    // a 401 from /login with bad credentials must not trigger a logout.
    const sentToken = Boolean(error.config?.headers?.Authorization)
    if (error.response?.status === 401 && sentToken && onUnauthorized) {
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

export default api
