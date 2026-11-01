import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Preview from './pages/Preview'
import Register from './pages/Register'
import Settings from './pages/Settings'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} position="top-right" richColors closeButton />
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedToaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<AppLayout />}>
              <Route path="/preview" element={<Preview />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="/components" element={<Navigate to="/preview" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
