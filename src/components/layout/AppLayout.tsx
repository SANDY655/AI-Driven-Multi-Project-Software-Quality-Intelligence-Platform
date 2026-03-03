import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { LogOut, Bug, LayoutDashboard, ChevronDown } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProfileSettingsModal } from '../projects/ProfileSettingsModal'

interface Profile {
    display_name: string
    avatar_url: string | null
    role: string
    github_username: string | null
}

export function AppLayout() {
    const { user, loading, signOut } = useAuth()
    const location = useLocation()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

    const isBoardView = location.pathname.endsWith('/board') || location.pathname.endsWith('/tasks')

    useEffect(() => {
        async function loadProfile() {
            if (!user) return
            const { data } = await supabase
                .from('profiles')
                .select('display_name, avatar_url, role, github_username')
                .eq('id', user.id)
                .single()
            if (data) setProfile(data)
        }
        loadProfile()
    }, [user])

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
                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-3 outline-none group hover:bg-zinc-100 p-1.5 rounded-full transition-colors pr-3">
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="h-8 w-8 rounded-full ring-2 ring-white shadow-sm object-cover" />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-sm ring-2 ring-white shadow-sm">
                                            {(profile?.display_name || user.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="hidden md:flex flex-col items-start text-sm text-left">
                                        <span className="font-semibold text-zinc-700 leading-none">
                                            {profile?.github_username ? `@${profile.github_username}` : (profile?.display_name || user.email)}
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors ml-1" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-white border-zinc-200">
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {profile?.github_username ? `@${profile.github_username}` : (profile?.display_name || 'User')}
                                            </p>
                                            {!profile?.github_username && (
                                                <p className="text-xs leading-none text-zinc-500">
                                                    {user.email}
                                                </p>
                                            )}
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-zinc-100" />
                                    <DropdownMenuItem className="text-zinc-600 hover:text-zinc-900 cursor-pointer focus:bg-zinc-50" onClick={() => setIsProfileModalOpen(true)}>
                                        Profile Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600 hover:text-red-700 cursor-pointer focus:bg-red-50 focus:text-red-700" onClick={signOut}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>
                )}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative flex flex-col ${!isBoardView ? 'p-8' : 'p-0'}`}>
                    <Outlet />
                </div>

                <ProfileSettingsModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                    user={user}
                    profile={profile}
                />
            </main>
        </div>
    )
}
