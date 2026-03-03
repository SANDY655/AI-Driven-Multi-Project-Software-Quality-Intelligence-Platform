import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CreateProjectModal } from '../components/projects/CreateProjectModal'
import { Github, FolderGit2, Lock } from 'lucide-react'

interface Profile {
    display_name: string
    role: string
    github_username: string | null
}

interface Project {
    id: string
    name: string
    project_code: string
    description: string
    github_repo: string
    github_owner: string
    github_details: any
    updated_at: string
}

export function Dashboard() {
    const { user } = useAuth()
    const [profile, setProfile] = useState<Profile | null>(null)
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)

    const loadData = async () => {
        if (!user) return

        // Load profile
        const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name, role, github_username')
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
    }

    useEffect(() => {
        loadData()
    }, [user])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Project Dashboard</h1>
                <CreateProjectModal onSuccess={loadData} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-zinc-500 text-sm font-medium mb-2">Welcome back</h3>
                    <p className="text-2xl font-semibold text-zinc-900">
                        {profile?.display_name || user?.email}
                    </p>
                    <div className="mt-4 flex gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                            {profile?.role || 'user'}
                        </span>
                    </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-zinc-500 text-sm font-medium mb-2">Active Projects</h3>
                    <p className="text-3xl font-semibold text-zinc-900">{projects.length}</p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-zinc-500 text-sm font-medium mb-2">Open Bugs</h3>
                    <p className="text-3xl font-semibold text-zinc-900">0</p>
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-semibold text-zinc-900 mb-4">Your Projects</h2>
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-32 bg-white rounded-2xl border border-zinc-200"></div>
                        <div className="h-32 bg-white rounded-2xl border border-zinc-200"></div>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="border border-zinc-200 bg-white shadow-sm rounded-2xl min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-zinc-500">
                            <FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-zinc-400" />
                            <p>No projects found.</p>
                            <p className="text-sm mt-1">Create a new project to get started.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="group block h-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-zinc-300 transition-all duration-200 hover:-translate-y-0.5"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="text-lg font-semibold text-zinc-800 group-hover:text-blue-600 transition-colors">
                                        {project.name}
                                    </h3>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {project.github_details?.private && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 px-2 py-0.5 rounded-full">
                                                <Lock className="h-2.5 w-2.5" /> Private
                                            </span>
                                        )}
                                        <span className="text-[11px] font-mono font-semibold bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md">
                                            {project.project_code}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-zinc-500 text-sm mb-6 line-clamp-2 min-h-[40px] leading-relaxed">
                                    {project.github_details?.description || 'No description provided.'}
                                </p>
                                <div className="flex items-center gap-4 text-[13px] font-medium text-zinc-400 mt-auto pt-4 border-t border-zinc-100">
                                    <span className="flex items-center gap-1.5">
                                        <Github className="h-3.5 w-3.5" />
                                        {project.github_owner}/{project.github_repo}
                                    </span>
                                    <span className="flex items-center gap-1.5 ml-auto">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        Active
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
