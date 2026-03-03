
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, Bug, LayoutDashboard } from 'lucide-react'

export function AppLayout() {
    const { user, loading, signOut } = useAuth()
    const location = useLocation()

    const isBoardView = location.pathname.endsWith('/board') || location.pathname.endsWith('/tasks')

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
        <div className="h-screen w-full flex overflow-hidden bg-zinc-50 text-zinc-900">
            {/* Sidebar */}
            <aside className={`${isBoardView ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out flex-shrink-0 border-r border-zinc-200 bg-white flex flex-col z-10 relative shadow-sm`}>
                <div className={`p-6 flex items-center ${isBoardView ? 'justify-center p-4' : 'gap-2'} border-b border-zinc-100 h-16`}>
                    <Bug className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    {!isBoardView && <span className="font-semibold text-lg tracking-tight text-zinc-800">Tracker</span>}
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-hidden">
                    <a
                        href="/"
                        className={`flex items-center ${isBoardView ? 'justify-center p-2' : 'gap-3 px-3 py-2'} text-sm font-medium rounded-md bg-blue-50 text-blue-700`}
                        title="Dashboard"
                    >
                        <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                        {!isBoardView && "Dashboard"}
                    </a>
                    {/* Add more links later */}
                </nav>

                <div className="p-4 border-t border-zinc-100">
                    <button
                        onClick={signOut}
                        className={`flex w-full items-center ${isBoardView ? 'justify-center p-2' : 'gap-3 px-3 py-2'} text-sm font-medium text-zinc-500 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-colors`}
                        title="Log out"
                    >
                        <LogOut className="h-4 w-4 flex-shrink-0" />
                        {!isBoardView && "Log out"}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-zinc-50 relative h-full">
                {!isBoardView && (
                    <header className="h-16 flex-shrink-0 border-b border-zinc-200 bg-white/50 backdrop-blur-sm flex items-center px-8 justify-between sticky top-0 z-20">
                        <h2 className="text-lg font-semibold text-zinc-800">Dashboard</h2>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-zinc-500">{user.email}</span>
                        </div>
                    </header>
                )}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative ${!isBoardView ? 'p-8' : 'p-0'}`}>
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
