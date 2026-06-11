import { Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import PublicLayout from './components/PublicLayout'
import ModuleListPage from './pages/admin/ModuleListPage'
import EditorPage from './pages/admin/EditorPage'
import ContentListPage from './pages/public/ContentListPage'
import ContentDetailPage from './pages/public/ContentDetailPage'
import FaqPage from './pages/public/FaqPage'
import ResourcesPage from './pages/public/ResourcesPage'

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
        <Route index element={<Navigate to="/admin/blogs" replace />} />
        <Route path=":module" element={<ModuleListPage />} />
        <Route path=":module/new" element={<EditorPage />} />
        <Route path=":module/:id/edit" element={<EditorPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
