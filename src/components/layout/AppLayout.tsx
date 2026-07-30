import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Bug, LogOut, LayoutDashboard, Loader2, Settings } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProfileSettingsModal } from '../projects/ProfileSettingsModal'
import { useDebounce } from 'use-debounce'
import { Search } from 'lucide-react'
import { AIChatAssistant } from '../projects/AIChatAssistant'

// Reuse the Project interface
interface Project {
    id: string
    name: string
    project_code: string
    description: string
    github_repo: string
    github_owner: string
    github_details: {
        private?: boolean;
        description?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    }
    updated_at: string
}

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

    // Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
    const [projects, setProjects] = useState<Project[]>([])
    const [isSearchFocused, setIsSearchFocused] = useState(false)

    // Check if the route is the dashboard Home
    const isDashboardPath = location.pathname === '/'
    // Check if the route is a board view
    const isBoardView = location.pathname.endsWith('/board') || location.pathname.endsWith('/tasks')

    // Fetch projects for search
    useEffect(() => {
        async function loadProjects() {
            if (!user) return
            const { data: projectsData, error } = await supabase
                .from('projects')
                .select('*, project_members!inner(project_id)')
                .eq('project_members.user_id', user.id)
                .order('updated_at', { ascending: false })

            if (projectsData && !error) {
                setProjects(projectsData)
            }
        }
        loadProjects()
    }, [user])

    const filteredSearchProjects = projects.filter(p =>
        p.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        p.project_code.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
    )

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
            <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-indigo-600">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="h-screen w-full flex overflow-hidden bg-[#FDFBF7] text-zinc-900 font-sans">
            {/* Minimal Modern Sidebar */}
            <aside className={`${isBoardView ? 'w-[72px]' : 'w-[260px]'} transition-all duration-300 ease-in-out flex-shrink-0 bg-white border-r border-zinc-100 flex flex-col z-10 relative shadow-sm`}>

                {/* Logo Area */}
                <div className={`pt-10 pb-10 flex items-center ${isBoardView ? 'justify-center px-0' : 'px-8 gap-3'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                        <Bug className="w-4 h-4" />
                    </div>
                    {!isBoardView && <span className="font-bold text-xl tracking-tight text-zinc-900 overflow-hidden whitespace-nowrap">BugTracker</span>}
                </div>

                {/* Navigation Menu */}
                <nav className={`flex-1 space-y-2 overflow-hidden mt-6 ${isBoardView ? 'px-2' : 'px-4'}`}>
                    {!isBoardView && (
                        <div className="px-5 mb-5 whitespace-nowrap overflow-hidden">
                            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.12em]">Overview</p>
                        </div>
                    )}

                    <Link
                        to="/"
                        className={`group flex items-center rounded-2xl transition-all relative ${isBoardView ? 'justify-center py-3 px-0 mx-auto w-12' : 'gap-4 px-5 py-3.5'
                            } ${isDashboardPath
                                ? 'text-zinc-900 font-bold bg-[#FDFDFE] shadow-sm ring-1 ring-zinc-100'
                                : 'text-zinc-500 font-semibold hover:text-zinc-800 hover:bg-[#FDFDFE] hover:shadow-sm hover:ring-1 hover:ring-zinc-100'
                            }`}
                        title="Dashboard"
                    >
                        {/* Active Indicator Line */}
                        {isDashboardPath && !isBoardView && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[7px] h-8 bg-[#6345FF] rounded-r-full"></div>
                        )}
                        <LayoutDashboard className={`h-5 w-5 flex-shrink-0 ${isDashboardPath ? 'text-[#6345FF]' : 'text-zinc-400 group-hover:text-zinc-600'} ${isDashboardPath && isBoardView && 'animate-pulse'}`} />
                        {!isBoardView && <span className="text-[16px] whitespace-nowrap overflow-hidden">Dashboard</span>}
                    </Link>

                    {/* Add more functional links here as they are built, following the same style */}
                </nav>

                {/* Bottom Section (Settings & Logout) */}
                <div className={`mb-6 mt-auto pt-8 border-t border-zinc-50 ${isBoardView ? 'p-2' : 'p-4'}`}>

                    <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className={`w-full flex items-center rounded-2xl hover:text-zinc-800 hover:bg-[#FDFDFE] transition-colors hover:shadow-sm hover:ring-1 hover:ring-zinc-100 mb-2 ${isBoardView ? 'justify-center py-3 px-0 mx-auto w-12 text-zinc-400' : 'gap-4 px-5 py-3.5 text-[16px] font-semibold text-zinc-500'
                            }`}
                        title="Settings"
                    >
                        <Settings className="h-5 w-5 flex-shrink-0" />
                        {!isBoardView && <span className="whitespace-nowrap overflow-hidden">Settings</span>}
                    </button>

                    <button
                        onClick={signOut}
                        className={`w-full flex items-center rounded-2xl hover:bg-rose-50 transition-colors ${isBoardView ? 'justify-center py-3 px-0 mx-auto w-12 text-rose-400' : 'gap-4 px-5 py-3.5 text-[16px] font-bold text-[#FF2D55]'
                            }`}
                        title="Log out"
                    >
                        <LogOut className="h-5 w-5 flex-shrink-0" />
                        {!isBoardView && <span className="whitespace-nowrap overflow-hidden">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FDFBF7] relative h-full">

                {/* Modern Header Search & Profile Area */}
                {!isBoardView && (
                    <header className="h-[100px] flex-shrink-0 bg-transparent flex items-center px-10 justify-between sticky top-0 z-20">

                        {/* Flexible Search Bar */}
                        <div className="flex-1 max-w-xl hidden md:flex relative z-50">
                            <div className={`w-full bg-white rounded-2xl border ${isSearchFocused ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-zinc-200/80'} px-5 py-2.5 flex items-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all`}>
                                <Search className={`w-4 h-4 mr-3 transition-colors ${isSearchFocused ? 'text-indigo-500' : 'text-zinc-400'}`} />
                                <input
                                    type="text"
                                    placeholder="Search your Project..."
                                    className="bg-transparent border-none outline-none w-full text-sm text-zinc-800 placeholder:text-zinc-400 font-medium"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setIsSearchFocused(true)}
                                    onBlur={() => {
                                        // Slight delay to allow clicking on results
                                        setTimeout(() => setIsSearchFocused(false), 200)
                                    }}
                                />
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchFocused && searchQuery.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-zinc-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="p-2 max-h-[300px] overflow-y-auto">
                                        <div className="px-3 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                            Projects
                                        </div>
                                        {filteredSearchProjects.length > 0 ? (
                                            filteredSearchProjects.map(project => (
                                                <Link
                                                    key={project.id}
                                                    to={`/projects/${project.id}`}
                                                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 rounded-xl transition-colors group"
                                                    onMouseDown={(e) => {
                                                        // Prevent default to stop the input from losing focus immediately before navigation happens
                                                        e.preventDefault();
                                                    }}
                                                    onClick={() => {
                                                        setSearchQuery('')
                                                        setIsSearchFocused(false)
                                                    }}
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                                                        <LayoutDashboard className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-bold text-zinc-900 truncate group-hover:text-indigo-600 transition-colors">
                                                            {project.name}
                                                        </h4>
                                                        <p className="text-xs text-zinc-500 truncate flex items-center gap-2">
                                                            <span className="font-semibold text-zinc-400">{project.project_code}</span>
                                                            <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                                                            {project.github_owner}/{project.github_repo}
                                                        </p>
                                                    </div>
                                                </Link>
                                            ))
                                        ) : (
                                            <div className="px-3 py-6 text-center text-sm text-zinc-500">
                                                No projects found matching "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-5 ml-auto">
                            {/* Notification Bells */}
                            <div className="hidden md:flex items-center gap-3">
                                <button className="w-10 h-10 rounded-full bg-white border border-zinc-100/80 flex items-center justify-center text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </button>
                                <button className="w-10 h-10 rounded-full bg-white border border-zinc-100/80 flex items-center justify-center text-zinc-600 shadow-sm hover:bg-zinc-50 transition-colors relative">
                                    <div className="absolute top-2.5 right-3 w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </button>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center gap-3 outline-none group hover:bg-white/50 p-1.5 rounded-full transition-colors">
                                    <span className="font-semibold text-zinc-800 text-sm hidden lg:block mr-1">
                                        {profile?.github_username ? `@${profile.github_username}` : (profile?.display_name || user.email)}
                                    </span>
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="h-10 w-10 rounded-full ring-4 ring-white shadow-sm object-cover bg-zinc-100" />
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm ring-4 ring-white shadow-sm">
                                            {(profile?.github_username || profile?.display_name || user.email || '?').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-white border-zinc-100 rounded-2xl p-2 shadow-xl">
                                    <DropdownMenuLabel className="font-normal px-2 py-3">
                                        <div className="flex flex-col space-y-1.5">
                                            <p className="text-sm font-bold leading-none text-zinc-900">
                                                {profile?.github_username ? `@${profile.github_username}` : (profile?.display_name || 'User')}
                                            </p>
                                            <p className="text-xs font-semibold text-zinc-500">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-zinc-100 mx-2" />
                                    <DropdownMenuItem className="text-zinc-600 hover:text-indigo-600 font-semibold cursor-pointer focus:bg-indigo-50 focus:text-indigo-600 rounded-xl px-3 py-2.5 mx-1" onClick={() => setIsProfileModalOpen(true)}>
                                        Profile Settings
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-rose-500 hover:text-rose-600 font-semibold cursor-pointer focus:bg-rose-50 focus:text-rose-600 rounded-xl px-3 py-2.5 mx-1" onClick={signOut}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>
                )}

                <div className={`flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative flex flex-col ${isBoardView ? 'p-0 w-full' : 'px-10 pb-10'}`}>
                    <Outlet />
                </div>

                <ProfileSettingsModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                    user={user}
                    profile={profile}
                />
                
                <AIChatAssistant />
            </main>
        </div>
    )
}
