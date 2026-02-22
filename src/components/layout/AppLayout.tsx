
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, Bug, LayoutDashboard } from 'lucide-react'

export function AppLayout() {
    const { user, loading, signOut } = useAuth()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="h-screen w-full flex overflow-hidden bg-zinc-950 text-zinc-50">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col z-10 relative">
                <div className="p-6 flex items-center gap-2 border-b border-zinc-800">
                    <Bug className="h-6 w-6 text-blue-500" />
                    <span className="font-semibold text-lg tracking-tight">Tracker</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <a
                        href="/"
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-blue-500/10 text-blue-400"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                    </a>
                    {/* Add more links later */}
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <button
                        onClick={signOut}
                        className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-zinc-400 rounded-md hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                        <LogOut className="h-4 w-4" />
                        Log out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
                <header className="h-16 flex-shrink-0 border-b border-zinc-800 bg-zinc-950/50 flex items-center px-8 justify-between">
                    <h2 className="text-lg font-medium text-zinc-200">Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-zinc-400">{user.email}</span>
                    </div>
                </header>
                <div className="p-8 flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
