
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { KanbanPage } from './pages/KanbanPage'
import { TaskKanbanPage } from './pages/TaskKanbanPage'

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
            <Route path="/projects/:id" element={<ProjectDashboard />} />
            <Route path="/projects/:id/board" element={<KanbanPage />} />
            <Route path="/projects/:id/tasks" element={<TaskKanbanPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
