import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CreateProjectModal } from '../components/projects/CreateProjectModal'
import { FolderGit2, Lock, ArrowUpRight, CircleDashed, Briefcase, Flame, User, MoreVertical, Radar, Network, Bot } from 'lucide-react'
import { aiClient } from '../lib/ai-client'

interface Profile {
    display_name: string
    role: string
    github_username: string | null
    avatar_url: string | null
}

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
        [key: string]: any; // Allow other properties but strongly type the ones we use
    }
    updated_at: string
}

export function Dashboard() {
    const { user } = useAuth()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [aiTesting, setAiTesting] = useState(false)
    const [isBackfilling, setIsBackfilling] = useState(false)

    const loadData = useCallback(async () => {
        if (!user) return

        // Load profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name, role, github_username, avatar_url')
            .eq('id', user.id)
            .single()

        if (profileData) setProfile(profileData)

        // Load projects this user is a member of
        const { data: projectsData, error } = await supabase
            .from('projects')
            .select('*, project_members!inner(project_id)')
            .eq('project_members.user_id', user.id)
            .order('updated_at', { ascending: false })

        if (projectsData && !error) {
            setProjects(projectsData)
        }
        setLoading(false)
    }, [user])

    useEffect(() => {
        loadData()
    }, [loadData])

    const totalOpenBugs = 0 // Placeholder logic for now

    // Helper for profile initials
    const getInitials = () => {
        if (profile?.display_name) return profile.display_name.charAt(0).toUpperCase()
        if (user?.email) return user.email.charAt(0).toUpperCase()
        return '?'
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 18) return 'Good afternoon'
        return 'Good evening'
    }

    const testAIEngine = async () => {
        setAiTesting(true);
        try {
            const response = await aiClient.analyzeBug({
                title: "App crashes on login",
                description: "When I click the login button with a valid email, the screen goes white and crashes.",
                project_id: projects.length > 0 ? projects[0].id : null
            });
            alert(`AI Prediction:\nPriority: ${response.prediction.priority}\nSeverity: ${response.prediction.severity}\n\nRationale:\n${response.prediction.rationale}`);
        } catch (error) {
            console.error("AI test failed:", error);
            alert("AI test failed. Make sure the Python server is running on port 8000!");
        } finally {
            setAiTesting(false);
        }
    }

    const handleBackfill = async () => {
        setIsBackfilling(true);
        try {
            const { data: bugs, error: bugsErr } = await supabase.from('bugs').select('id, title, description, project_id');
            if (bugsErr) throw bugsErr;
            
            const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('id, title, description, project_id');
            if (tasksErr) throw tasksErr;

            let bugCount = 0;
            let taskCount = 0;

            for (const bug of bugs || []) {
                await aiClient.embedBug(bug.id, {
                    title: bug.title,
                    description: bug.description || '',
                    project_id: bug.project_id
                });
                bugCount++;
            }

            for (const task of tasks || []) {
                await aiClient.embedTask(task.id, {
                    title: task.title,
                    description: task.description || ''
                });
                taskCount++;
            }

            alert(`AI Embeddings Backfill Complete!\nSuccessfully embedded ${bugCount} bugs and ${taskCount} tasks.`);
        } catch (error) {
            console.error("Backfill failed:", error);
            alert("Backfill failed. Please ensure the Python FastAPI server is running on port 8000!");
        } finally {
            setIsBackfilling(false);
        }
    }


    return (
        <div className="flex flex-col xl:flex-row gap-8 min-h-full font-sans pb-8 -mt-2">

            {/* Main Left Content */}
            <div className="flex-1 min-w-0 space-y-8">

                {/* AI Testing Card - MOVED TO TOP FOR VISIBILITY */}
                <div className="bg-indigo-50 rounded-[24px] p-6 shadow-sm border border-indigo-200 flex flex-col md:flex-row items-center justify-between text-left gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 mb-1">Test AI Engine (RAG)</h3>
                            <p className="text-sm text-indigo-700/80 m-0">Run a mock bug through the local RAG engine to test Priority and Severity prediction.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            onClick={testAIEngine}
                            disabled={aiTesting || isBackfilling}
                            className="py-3 px-6 bg-[#634AF9] hover:bg-[#523AE0] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm cursor-pointer"
                        >
                            {aiTesting ? 'Analyzing...' : 'Run Test Analysis'}
                        </button>
                        <button 
                            onClick={handleBackfill}
                            disabled={aiTesting || isBackfilling}
                            className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 whitespace-nowrap shadow-sm cursor-pointer"
                        >
                            {isBackfilling ? 'Backfilling...' : 'Backfill AI Embeddings'}
                        </button>
                    </div>
                </div>

                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-[32px] bg-[#634AF9] text-white p-8 md:p-10 shadow-lg w-full flex flex-col justify-center min-h-[220px]">
                    {/* Decorative Tracking Style Background */}
                    <div className="absolute inset-0 opacity-[0.15] pointer-events-none" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                    <div className="absolute top-0 right-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
                        <Radar className="absolute -right-[5%] -top-[10%] w-[350px] h-[350px] text-white" strokeWidth={0.5} />
                        <Network className="absolute right-[30%] bottom-[5%] w-32 h-32 text-white/40" strokeWidth={1} />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase text-white mb-5 border border-white/10">
                            BUGTRACKER WORKSPACE
                        </div>
                        <h1 className="text-3xl md:text-[40px] font-semibold mb-6 leading-[1.15] tracking-tight">
                            Streamline your workflow with <br /> Professional Bug Tracking
                        </h1>
                        <div className="flex items-center gap-4">
                            <CreateProjectModal onSuccess={loadData} />
                        </div>
                    </div>
                </div>

                {/* Quick Stats Pills */}
                <div className="flex flex-wrap gap-4">
                    {/* Active Projects Pill */}
                    <div className="bg-white rounded-[24px] p-2.5 pr-6 shadow-sm border border-zinc-100 flex items-center gap-4 cursor-default">
                        <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Active Projects</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-zinc-900 leading-none">{projects.length}</span>
                                <span className="text-xs font-medium text-zinc-500">total</span>
                            </div>
                        </div>
                    </div>

                    {/* Open Bugs Pill */}
                    <div className="bg-white rounded-[24px] p-2.5 pr-6 shadow-sm border border-zinc-100 flex items-center gap-4 cursor-default">
                        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                            <CircleDashed className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Open Bugs</p>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-zinc-900 leading-none">{totalOpenBugs}</span>
                                <span className="text-xs font-medium text-zinc-500">issues</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Projects Section */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-[22px] font-bold text-zinc-900 tracking-tight">Your Projects</h2>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="animate-pulse h-64 bg-white rounded-[32px] border border-zinc-100 shadow-sm"></div>
                            <div className="animate-pulse h-64 bg-white rounded-[32px] border border-zinc-100 shadow-sm"></div>
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="bg-white rounded-[32px] border border-zinc-100 shadow-sm min-h-[300px] flex items-center justify-center p-8">
                            <div className="text-center text-zinc-500 max-w-sm">
                                <div className="bg-zinc-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <FolderGit2 className="h-10 w-10 text-zinc-400" />
                                </div>
                                <h3 className="text-xl font-bold text-zinc-900 mb-2">No projects yet</h3>
                                <p className="text-sm text-zinc-500 leading-relaxed mb-6">
                                    Get started by creating your first project to organize your team's workflow and bugs.
                                </p>
                                <CreateProjectModal onSuccess={loadData} />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map((project) => (
                                <Link
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className="group block bg-white border border-zinc-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 block h-full flex flex-col relative overflow-hidden"
                                >
                                    {/* Abstract top background instead of an image cover */}
                                    <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-50 to-blue-50/20 opacity-50 pointer-events-none"></div>

                                    <div className="relative z-10 flex flex-col h-full">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest bg-indigo-100/80 text-indigo-700 px-2.5 py-1 rounded-md">
                                                    {project.project_code}
                                                </span>
                                                {project.github_details?.private && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-md">
                                                        <Lock className="h-3 w-3" /> Private
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <h3 className="text-[19px] font-bold text-zinc-900 mb-2 group-hover:text-[#634AF9] transition-colors line-clamp-2 leading-snug">
                                            {project.name}
                                        </h3>

                                        <p className="text-zinc-500 text-sm mb-6 line-clamp-2 leading-relaxed flex-grow">
                                            {project.github_details?.description || 'No description provided for this repository.'}
                                        </p>

                                        {/* Bottom Action Bar (Mentor equivalent) */}
                                        <div className="flex items-center justify-between text-[13px] font-bold text-zinc-500 mt-auto pt-4 border-t border-zinc-100/80">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                                                    {project.github_owner ? (
                                                        <img src={`https://github.com/${project.github_owner}.png`} alt={project.github_owner} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-3.5 h-3.5 text-zinc-400" />
                                                    )}
                                                </div>
                                                <span className="truncate max-w-[120px] text-zinc-700 font-semibold">{project.github_owner}</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-full border border-zinc-200 flex items-center justify-center group-hover:bg-[#634AF9] group-hover:border-[#634AF9] group-hover:text-white text-zinc-400 transition-colors">
                                                <ArrowUpRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full xl:w-[320px] flex-shrink-0 space-y-8">
                {/* Overview Card */}
                <div className="bg-white rounded-[32px] p-8 shadow-sm border border-zinc-100 flex flex-col items-center text-center">
                    <div className="w-full flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-zinc-900">Overview</h3>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center cursor-pointer hover:bg-zinc-100 text-zinc-400">
                            <MoreVertical className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="relative mb-5">
                        {/* Circular Progress Placeholder Ring */}
                        <svg className="absolute -inset-2 w-28 h-28 text-indigo-100" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
                        </svg>
                        <svg className="absolute -inset-2 w-28 h-28 text-indigo-500 -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="289" strokeDashoffset="60" className="drop-shadow-sm" />
                        </svg>

                        <div className="w-24 h-24 rounded-full overflow-hidden flex-shrink-0 shadow-md ring-4 ring-white relative z-10 bg-zinc-100">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-400">
                                    {getInitials()}
                                </div>
                            )}
                        </div>
                        {/* Progress Badge */}
                        <div className="absolute -top-3 -right-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-20 shadow-sm border-2 border-white">
                            PRO
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-zinc-900 mb-1 flex items-center justify-center gap-1.5">
                        {getGreeting()}, {profile?.github_username || profile?.display_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'} <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                    </h2>
                    <p className="text-sm text-zinc-500 leading-relaxed mb-6 px-2">
                        Continue managing your projects and resolving bugs efficiently!
                    </p>

                    <div className="w-full h-px bg-zinc-100 my-2"></div>

                    {/* Simple summary stats instead of a chart since we don't have chart data */}
                    <div className="w-full grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100/50">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Projects</p>
                            <p className="text-xl font-bold text-zinc-900">{projects.length}</p>
                        </div>
                        <div className="bg-zinc-50 rounded-2xl p-4 text-center border border-zinc-100/50">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Role</p>
                            <p className="text-sm font-bold text-indigo-600 capitalize mt-1 truncate">{profile?.role || 'Member'}</p>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    )
}

