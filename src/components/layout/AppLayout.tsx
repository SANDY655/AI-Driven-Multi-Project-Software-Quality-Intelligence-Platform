import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
    Bug, 
    LayoutDashboard, 
    Loader2, 
    Settings,
    Search,
    Bell,
    ChevronDown,
    KanbanSquare,
    ListTodo,
    BarChart2,
    Menu,
    ChevronLeft,
    Plus,
    CheckSquare,
    AlertCircle,
    Activity,
    Tag
} from 'lucide-react'
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
import { AIChatAssistant } from '../projects/AIChatAssistant'
import { CreateBugModal } from '../projects/CreateBugModal'
import { CreateTaskModal } from '../projects/tasks/CreateTaskModal'

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
    const navigate = useNavigate()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const [createModalType, setCreateModalType] = useState<'bug' | 'task' | null>(null)
    const [notifications, setNotifications] = useState<any[]>([])
    const [notifOpen, setNotifOpen] = useState(false)
    const [notifLoading, setNotifLoading] = useState(false)

    // Search State
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
    const [projects, setProjects] = useState<Project[]>([])
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    // Contextual routing checks
    const isProjectRoute = location.pathname.startsWith('/projects/')
    const projectIdMatch = location.pathname.match(/\/projects\/([^/]+)/)
    const currentProjectId = projectIdMatch ? projectIdMatch[1] : null
    
    const currentProject = projects.find(p => p.id === currentProjectId)

    // Fetch projects
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

    // Load recent notifications from activity_log
    useEffect(() => {
        if (!notifOpen || !user) return
        setNotifLoading(true)
        supabase
            .from('activity_log')
            .select(`
                id, action, old_value, new_value, created_at,
                profiles:user_id (display_name, avatar_url),
                bugs (bug_display_id, title)
            `)
            .order('created_at', { ascending: false })
            .limit(10)
            .then(({ data }) => {
                if (data) setNotifications(data)
                setNotifLoading(false)
            })
    }, [notifOpen, user])

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
            <div className="min-h-screen flex items-center justify-center bg-white text-[#0747A6]">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-white text-[#172B4D] font-sans">
            
            {/* GLOBAL TOP NAVIGATION (Jira Style) */}
            <header className="h-[56px] bg-white border-b border-[#DFE1E6] flex items-center px-4 justify-between flex-shrink-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                
                {/* Left Side: Logo & Main Menus */}
                <div className="flex items-center h-full">
                    <Link to="/" className="flex items-center gap-2 mr-6 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded bg-[#0747A6] flex items-center justify-center text-white">
                            <Bug className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-[#172B4D] text-lg tracking-tight hidden sm:block">BugTracker</span>
                    </Link>

                    <nav className="hidden md:flex items-center h-full gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger className="h-8 px-3 rounded text-[#42526E] font-medium hover:bg-[#EBECF0] hover:text-[#172B4D] transition-colors flex items-center gap-1 text-sm outline-none">
                                Your work
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 bg-white border-[#DFE1E6] shadow-md rounded-md p-2">
                                <DropdownMenuItem className="text-sm cursor-pointer" onClick={() => navigate('/')}>
                                    Recent projects
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger className="h-8 px-3 rounded text-[#42526E] font-medium hover:bg-[#EBECF0] hover:text-[#172B4D] transition-colors flex items-center gap-1 text-sm outline-none">
                                Projects
                                <ChevronDown className="w-4 h-4 opacity-50" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64 bg-white border-[#DFE1E6] shadow-md rounded-md p-2">
                                <DropdownMenuLabel className="text-xs font-bold text-[#5E6C84] uppercase">Recent</DropdownMenuLabel>
                                {projects.slice(0, 3).map(p => (
                                    <DropdownMenuItem key={p.id} className="text-sm cursor-pointer py-2" onClick={() => navigate(`/projects/${p.id}`)}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-[#EAE6FF] text-[#403294] flex items-center justify-center font-bold text-[10px]">
                                                {p.project_code.substring(0, 2)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-[#172B4D]">{p.name}</span>
                                                <span className="text-xs text-[#5E6C84]">{p.project_code}</span>
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-sm cursor-pointer text-[#0052CC]" onClick={() => navigate('/')}>
                                    View all projects
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild className="outline-none">
                                <button className="h-8 ml-2 px-3 bg-[#0052CC] hover:bg-[#0047B3] text-white text-sm font-medium rounded transition-colors flex items-center gap-1.5 shadow-sm">
                                    <Plus className="w-4 h-4" />
                                    Create
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 bg-white border-[#DFE1E6] shadow-md rounded p-1 mt-1">
                                <DropdownMenuLabel className="text-xs font-bold text-[#5E6C84] uppercase">Create</DropdownMenuLabel>
                                <DropdownMenuItem
                                    className="text-sm cursor-pointer py-2 flex items-center gap-2"
                                    onClick={() => setCreateModalType('bug')}
                                >
                                    <div className="w-5 h-5 rounded bg-[#FFEBE6] text-[#DE350B] flex items-center justify-center">
                                        <AlertCircle className="w-3 h-3" />
                                    </div>
                                    {currentProjectId ? 'Bug in this project' : 'Bug report'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-sm cursor-pointer py-2 flex items-center gap-2"
                                    onClick={() => setCreateModalType('task')}
                                >
                                    <div className="w-5 h-5 rounded bg-[#E3FCEF] text-[#006644] flex items-center justify-center">
                                        <CheckSquare className="w-3 h-3" />
                                    </div>
                                    {currentProjectId ? 'Task in this project' : 'Task'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </nav>
                </div>

                {/* Right Side: Search, Notifications, Profile */}
                <div className="flex items-center gap-4">
                    {/* Search Bar */}
                    <div className="relative hidden lg:block w-[240px]">
                        <div className={`flex items-center h-8 rounded border transition-all ${isSearchFocused ? 'border-[#4C9AFF] shadow-[0_0_0_2px_rgba(76,154,255,0.2)] bg-white' : 'border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0]'}`}>
                            <Search className="w-4 h-4 ml-2 text-[#5E6C84]" />
                            <input
                                type="text"
                                placeholder="Search"
                                className="w-full bg-transparent border-none outline-none px-2 text-sm text-[#172B4D] placeholder:text-[#5E6C84]"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            />
                        </div>
                        {/* Search Results Dropdown */}
                        {isSearchFocused && searchQuery.length > 0 && (
                            <div className="absolute top-full mt-1 right-0 w-[300px] bg-white border border-[#DFE1E6] shadow-md rounded z-50 py-2">
                                <div className="px-3 py-1 text-xs font-bold text-[#5E6C84] uppercase">Projects</div>
                                {filteredSearchProjects.length > 0 ? (
                                    filteredSearchProjects.map(project => (
                                        <div
                                            key={project.id}
                                            className="px-3 py-2 hover:bg-[#F4F5F7] cursor-pointer flex items-center gap-2"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => {
                                                setSearchQuery('')
                                                setIsSearchFocused(false)
                                                navigate(`/projects/${project.id}`)
                                            }}
                                        >
                                            <div className="w-6 h-6 rounded bg-[#EAE6FF] text-[#403294] flex items-center justify-center font-bold text-[10px]">
                                                {project.project_code.substring(0,2)}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-medium text-[#172B4D] truncate">{project.name}</span>
                                                <span className="text-xs text-[#5E6C84]">{project.project_code}</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="px-3 py-2 text-sm text-[#5E6C84]">No results found.</div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            className="text-[#42526E] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-full transition-colors relative"
                            onClick={() => setNotifOpen(o => !o)}
                        >
                            <Bell className="w-5 h-5" />
                            {notifications.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF5630] rounded-full border border-white"></span>
                            )}
                        </button>
                        {notifOpen && (
                            <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-[#DFE1E6] shadow-[0_8px_16px_rgba(9,30,66,0.15)] rounded z-50">
                                <div className="px-4 py-3 border-b border-[#DFE1E6] flex items-center justify-between">
                                    <span className="font-semibold text-[14px] text-[#172B4D] flex items-center gap-2">
                                        <Bell className="w-4 h-4" /> Notifications
                                    </span>
                                    <button onClick={() => setNotifOpen(false)} className="text-xs text-[#5E6C84] hover:text-[#172B4D]">Close</button>
                                </div>
                                <div className="max-h-[380px] overflow-y-auto">
                                    {notifLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-5 h-5 animate-spin text-[#0052CC]" />
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="py-10 text-center text-[#5E6C84] text-sm">
                                            <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
                                            No recent activity
                                        </div>
                                    ) : notifications.map(n => (
                                        <div key={n.id} className="px-4 py-3 border-b border-[#DFE1E6] hover:bg-[#F4F5F7] flex items-start gap-3">
                                            {n.profiles?.avatar_url ? (
                                                <img src={n.profiles.avatar_url} className="w-7 h-7 rounded-full mt-0.5 flex-shrink-0" alt="" />
                                            ) : (
                                                <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                                    {n.profiles?.display_name?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-[#172B4D]">
                                                    <span className="font-semibold">{n.profiles?.display_name || 'Someone'}</span>
                                                    {' '}{n.action.replace(/_/g, ' ')}
                                                    {n.bugs?.bug_display_id && <span className="text-[#0052CC] font-medium"> on {n.bugs.bug_display_id}</span>}
                                                </p>
                                                {n.old_value && n.new_value && (
                                                    <p className="text-xs text-[#5E6C84] mt-0.5">{n.old_value} → {n.new_value}</p>
                                                )}
                                                <p className="text-xs text-[#A5ADBA] mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-2.5 bg-[#FAFBFC] border-t border-[#DFE1E6] text-center">
                                    <button onClick={() => { setNotifOpen(false); navigate('/inbox') }} className="text-xs font-bold text-[#0052CC] hover:underline">
                                        Open Full Inbox & SLA Alerts →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <button className="text-[#42526E] hover:text-[#172B4D] hover:bg-[#EBECF0] p-1.5 rounded-full transition-colors" onClick={() => navigate('/profile')}>
                        <Settings className="w-5 h-5" />
                    </button>

                    {/* Profile Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger className="outline-none">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Profile" className="w-8 h-8 rounded-full border border-[#DFE1E6] hover:opacity-80" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs hover:opacity-80 transition-opacity cursor-pointer">
                                    {(profile?.github_username || profile?.display_name || user.email || '?').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white border-[#DFE1E6] shadow-md rounded p-1">
                            <div className="px-3 py-3 border-b border-[#DFE1E6] mb-1">
                                <p className="text-sm font-medium text-[#172B4D]">
                                    {profile?.github_username ? `@${profile.github_username}` : (profile?.display_name || 'User')}
                                </p>
                                <p className="text-xs text-[#5E6C84] truncate">{user.email}</p>
                            </div>
                            <DropdownMenuItem className="text-sm text-[#172B4D] cursor-pointer hover:bg-[#F4F5F7] rounded font-medium" onClick={() => navigate('/profile')}>
                                My Profile & Work
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-sm text-[#172B4D] cursor-pointer hover:bg-[#F4F5F7] rounded" onClick={() => navigate('/inbox')}>
                                Notifications Inbox
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-sm text-[#DE350B] cursor-pointer hover:bg-[#FFEBE6] rounded" onClick={signOut}>
                                Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                
                {/* CONTEXTUAL PROJECT SIDEBAR (Jira Style) */}
                {isProjectRoute && currentProject && (
                    <aside 
                        className={`bg-[#FAFBFC] border-r border-[#DFE1E6] flex flex-col transition-all duration-300 ease-in-out relative z-40 ${isSidebarCollapsed ? 'w-[20px]' : 'w-[240px]'}`}
                        onMouseEnter={() => isSidebarCollapsed && setIsSidebarCollapsed(false)}
                    >
                        {!isSidebarCollapsed && (
                            <>
                                {/* Project Header */}
                                <div className="px-4 py-6 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-[#EAE6FF] text-[#403294] flex flex-shrink-0 items-center justify-center font-bold text-sm">
                                        {currentProject.project_code.substring(0,2)}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="font-semibold text-[#172B4D] truncate text-sm" title={currentProject.name}>{currentProject.name}</span>
                                        <span className="text-xs text-[#5E6C84]">Software project</span>
                                    </div>
                                </div>

                                {/* Navigation Links */}
                                <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
                                    <div className="px-3 py-2 text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1 mt-2">Planning</div>
                                    <Link 
                                        to={`/projects/${currentProjectId}/board`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/board') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <KanbanSquare className="w-4 h-4" />
                                        Board
                                    </Link>
                                    <Link 
                                        to={`/projects/${currentProjectId}/tasks`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/tasks') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <ListTodo className="w-4 h-4" />
                                        Tasks
                                    </Link>
                                    <Link 
                                        to={`/projects/${currentProjectId}/backlog`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/backlog') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <Menu className="w-4 h-4" />
                                        Backlog
                                    </Link>
                                    <Link 
                                        to={`/projects/${currentProjectId}/timeline`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/timeline') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <Activity className="w-4 h-4" />
                                        Timeline
                                    </Link>
                                    
                                    <div className="px-3 py-2 text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1 mt-4">Development</div>
                                    <Link 
                                        to={`/projects/${currentProjectId}`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname === `/projects/${currentProjectId}` ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Project Summary
                                    </Link>
                                    <Link 
                                        to={`/projects/${currentProjectId}/analytics`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/analytics') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        Reports
                                    </Link>
                                    <Link 
                                        to={`/projects/${currentProjectId}/releases`}
                                        className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${location.pathname.endsWith('/releases') ? 'bg-[#E9F2FF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                                    >
                                        <Tag className="w-4 h-4" />
                                        Releases
                                    </Link>
                                </nav>
                                
                                <div className="p-4 border-t border-[#DFE1E6]">
                                    <button className="flex items-center gap-3 px-3 py-2 w-full rounded text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] transition-colors">
                                        <Settings className="w-4 h-4" />
                                        Project settings
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Collapse Toggle */}
                        <div 
                            className="absolute -right-3 top-6 w-6 h-6 bg-white border border-[#DFE1E6] rounded-full flex items-center justify-center cursor-pointer text-[#42526E] hover:bg-[#0052CC] hover:text-white hover:border-[#0052CC] shadow-sm transition-all z-50"
                            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        >
                            <ChevronLeft className={`w-4 h-4 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                        </div>
                    </aside>
                )}

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 overflow-y-auto flex flex-col relative bg-white h-full">
                    <Outlet />
                    <AIChatAssistant />
                </main>
            </div>

            <ProfileSettingsModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                user={user}
                profile={profile}
            />

            {/* Global Create Modals — only work when inside a project */}
            {createModalType === 'bug' && currentProjectId && currentProject && (
                <CreateBugModal
                    projectId={currentProjectId}
                    projectCode={currentProject.project_code}
                    onSuccess={() => setCreateModalType(null)}
                />
            )}
            {createModalType === 'task' && currentProjectId && currentProject && (
                <CreateTaskModal
                    projectId={currentProjectId}
                    projectCode={currentProject.project_code}
                    onSuccess={() => setCreateModalType(null)}
                />
            )}
            {createModalType && !currentProjectId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setCreateModalType(null)}>
                    <div className="bg-white rounded shadow-lg p-8 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
                        <p className="text-[#172B4D] font-medium mb-2">Select a project first</p>
                        <p className="text-[#5E6C84] text-sm mb-4">Navigate into a project to create bugs or tasks.</p>
                        <button onClick={() => setCreateModalType(null)} className="px-4 py-2 bg-[#0052CC] text-white rounded text-sm font-medium hover:bg-[#0047B3]">OK</button>
                    </div>
                </div>
            )}
        </div>
    )
}
