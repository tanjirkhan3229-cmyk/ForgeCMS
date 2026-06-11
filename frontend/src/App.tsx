import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './components/PublicLayout'
import StatusTilePage from './pages/admin/StatusTilePage'
import EditorPage from './pages/admin/EditorPage'
import MediaLibraryPage from './pages/admin/MediaLibraryPage'
import SettingsPage from './pages/admin/SettingsPage'
import ContentListPage from './pages/public/ContentListPage'
import ContentDetailPage from './pages/public/ContentDetailPage'
import FaqPage from './pages/public/FaqPage'
import ResourcesPage from './pages/public/ResourcesPage'

function ModuleIndexRedirect() {
  const { module } = useParams()
  return <Navigate to={`/admin/${module}/drafts`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Navigate to="/blogs" replace />} />
        <Route path="/blogs" element={<ContentListPage module="blogs" />} />
        <Route path="/blogs/:slug" element={<ContentDetailPage module="blogs" />} />
        <Route path="/news" element={<ContentListPage module="news" />} />
        <Route path="/news/:slug" element={<ContentDetailPage module="news" />} />
        <Route path="/faqs" element={<FaqPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/blogs/drafts" replace />} />
        <Route path="media" element={<MediaLibraryPage />} />
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
