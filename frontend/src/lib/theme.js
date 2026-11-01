// Keep in sync with the inline script in index.html, which applies the theme before React loads.
export const THEME_STORAGE_KEY = 'theme'
export const THEMES = ['light', 'dark', 'system']

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return THEMES.includes(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode, quota); the theme still applies for this session.
  }
}

export function systemPrefersDark() {
  return darkQuery().matches
}

export function subscribeToSystemTheme(callback) {
  const query = darkQuery()
  const listener = (event) => callback(event.matches)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

export function applyTheme(resolved) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
