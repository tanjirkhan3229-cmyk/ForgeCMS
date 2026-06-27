import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import AdminLayout from './components/AdminLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import StatusTilePage from './pages/admin/StatusTilePage'
import EditorPage from './pages/admin/EditorPage'
import KnowledgeBasePage from './pages/admin/KnowledgeBasePage'
import MediaLibraryPage from './pages/admin/MediaLibraryPage'
import SettingsPage from './pages/admin/SettingsPage'
import { getToken } from './lib/api'

function ModuleIndexRedirect() {
  const { module } = useParams()
  return <Navigate to={`/admin/${module}/drafts`} replace />
}

/** Gate for the admin studio: no token → login page. */
function RequireAuth({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
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
