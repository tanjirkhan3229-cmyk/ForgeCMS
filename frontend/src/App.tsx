import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './components/PublicLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import StatusTilePage from './pages/admin/StatusTilePage'
import EditorPage from './pages/admin/EditorPage'
import KnowledgeBasePage from './pages/admin/KnowledgeBasePage'
import MediaLibraryPage from './pages/admin/MediaLibraryPage'
import SettingsPage from './pages/admin/SettingsPage'
import ContentListPage from './pages/public/ContentListPage'
import ContentDetailPage from './pages/public/ContentDetailPage'
import FaqPage from './pages/public/FaqPage'
import ResourcesPage from './pages/public/ResourcesPage'
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
      {/* The studio is the front door — public content lives under explicit paths. */}
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<PublicLayout />}>
        <Route path="/blogs" element={<ContentListPage module="blogs" />} />
        <Route path="/blogs/:slug" element={<ContentDetailPage module="blogs" />} />
        <Route path="/news" element={<ContentListPage module="news" />} />
        <Route path="/news/:slug" element={<ContentDetailPage module="news" />} />
        <Route path="/faqs" element={<FaqPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
      </Route>

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
