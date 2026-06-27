import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import StatusTilePage from './pages/admin/StatusTilePage'
import EditorPage from './pages/admin/EditorPage'
import KnowledgeBasePage from './pages/admin/KnowledgeBasePage'
import MediaLibraryPage from './pages/admin/MediaLibraryPage'
import SettingsPage from './pages/admin/SettingsPage'
import { authApi } from './lib/api'

function ModuleIndexRedirect() {
  const { module } = useParams()
  return <Navigate to={`/admin/${module}/drafts`} replace />
}

/**
 * Gate for the admin studio. The session is an httpOnly cookie that JS can't
 * read, so we verify it by asking the backend who we are: /api/auth/me succeeds
 * → authed, 401 → off to login.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'denied'>('checking')
  useEffect(() => {
    let active = true
    authApi
      .me()
      .then(() => active && setStatus('authed'))
      .catch(() => active && setStatus('denied'))
    return () => {
      active = false
    }
  }, [])
  if (status === 'checking') return null
  if (status === 'denied') return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Headless CMS: this app is the admin studio only. Public content is
          served via the API and rendered by the separate forgesop.com frontend. */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="media" element={<MediaLibraryPage />} />
        <Route path="knowledge" element={<KnowledgeBasePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path=":module" element={<ModuleIndexRedirect />} />
        <Route path=":module/drafts" element={<StatusTilePage status="draft" />} />
        <Route path=":module/published" element={<StatusTilePage status="published" />} />
        <Route path=":module/scheduled" element={<StatusTilePage status="scheduled" />} />
        <Route path=":module/new" element={<EditorPage />} />
        <Route path=":module/:id/edit" element={<EditorPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
