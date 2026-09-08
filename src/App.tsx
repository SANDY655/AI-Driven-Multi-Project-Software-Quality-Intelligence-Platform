
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { KanbanPage } from './pages/KanbanPage'
import { TaskKanbanPage } from './pages/TaskKanbanPage'
import { BugDetailPage } from './pages/BugDetailPage'
import { BacklogPage } from './pages/BacklogPage'
import { SprintAnalytics } from './pages/SprintAnalytics'
import { ProfilePage } from './pages/ProfilePage'
import { TimelinePage } from './pages/TimelinePage'
import { InboxPage } from './pages/InboxPage'
import { ReleasesPage } from './pages/ReleasesPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/projects/:id" element={<ProjectDashboard />} />
            <Route path="/projects/:id/board" element={<KanbanPage />} />
            <Route path="/projects/:id/tasks" element={<TaskKanbanPage />} />
            <Route path="/projects/:id/backlog" element={<BacklogPage />} />
            <Route path="/projects/:id/timeline" element={<TimelinePage />} />
            <Route path="/projects/:id/releases" element={<ReleasesPage />} />
            <Route path="/projects/:id/analytics" element={<SprintAnalytics />} />
            <Route path="/projects/:id/bugs/:bugId" element={<BugDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
