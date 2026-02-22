import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CreateProjectModal } from '../components/projects/CreateProjectModal'
import { Github, FolderGit2 } from 'lucide-react'

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
                <h1 className="text-3xl font-bold tracking-tight text-white">Project Dashboard</h1>
                <CreateProjectModal onSuccess={loadData} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-zinc-400 text-sm font-medium mb-2">Welcome back</h3>
                    <p className="text-2xl font-semibold text-white">
                        {profile?.display_name || user?.email}
                    </p>
                    <div className="mt-4 flex gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                            {profile?.role || 'user'}
                        </span>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-zinc-400 text-sm font-medium mb-2">Active Projects</h3>
                    <p className="text-3xl font-semibold text-white">{projects.length}</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-zinc-400 text-sm font-medium mb-2">Open Bugs</h3>
                    <p className="text-3xl font-semibold text-white">0</p>
                </div>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-semibold text-white mb-4">Your Projects</h2>
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-32 bg-zinc-900 rounded-xl border border-zinc-800"></div>
                        <div className="h-32 bg-zinc-900 rounded-xl border border-zinc-800"></div>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl min-h-[300px] flex items-center justify-center">
                        <div className="text-center text-zinc-500">
                            <FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No projects found.</p>
                            <p className="text-sm mt-1">Create a new project to get started.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {projects.map((project) => (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="group block h-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                                        {project.name}
                                    </h3>
                                    <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded">
                                        {project.project_code}
                                    </span>
                                </div>
                                <p className="text-zinc-400 text-sm mb-4 line-clamp-2 min-h-[40px]">
                                    {project.github_details?.description || 'No description provided.'}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-zinc-500 mt-auto pt-4 border-t border-zinc-800/50">
                                    <span className="flex items-center gap-1">
                                        <Github className="h-3 w-3" />
                                        {project.github_owner}/{project.github_repo}
                                    </span>
                                    <span className="flex items-center gap-1 ml-auto">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
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
