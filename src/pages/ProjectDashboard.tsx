import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getRepoContributors, getRepoCollaborators } from '../lib/github'
import { InviteMemberModal } from '../components/projects/InviteMemberModal'
import { EditMemberRoleModal } from '../components/projects/EditMemberRoleModal'
import { EditProjectModal } from '../components/projects/EditProjectModal'
import { CreateBugModal } from '../components/projects/CreateBugModal'
import { CreateTaskModal } from '../components/projects/tasks/CreateTaskModal'
import { Button } from '@/components/ui/button'
import { Github, Users, Bug, AlertCircle, ArrowLeft, Trash2, Columns, ExternalLink, CheckSquare, Lock, ShieldCheck } from 'lucide-react'

interface Project {
    id: string
    name: string
    project_code: string
    description: string
    created_by: string
    github_repo_url: string
    github_repo: string
    github_owner: string
    github_details: any
    created_at: string
    project_members?: Array<{
        project_role: string
        profiles: {
            id: string
            display_name: string
            avatar_url: string
            github_username: string
            email: string
        }
    }>
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-500/20 text-red-400 ring-red-500/30' },
    owner: { label: 'Owner', color: 'bg-purple-500/20 text-purple-400 ring-purple-500/30' },
    write: { label: 'Write', color: 'bg-blue-500/20 text-blue-400 ring-blue-500/30' },
    maintain: { label: 'Maintain', color: 'bg-amber-500/20 text-amber-400 ring-amber-500/30' },
    triage: { label: 'Triage', color: 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30' },
    read: { label: 'Read', color: 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30' },
}

function RoleBadge({ role }: { role: string }) {
    const badge = ROLE_BADGE[role] ?? { label: role, color: 'bg-zinc-500/20 text-zinc-400 ring-zinc-500/30' }
    return (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ring-1 ring-inset uppercase ${badge.color}`}>
            {badge.label}
        </span>
    )
}

export function ProjectDashboard() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user, session } = useAuth()
    const [project, setProject] = useState<Project | null>(null)
    const [contributors, setContributors] = useState<any[]>([])
    const [collaborators, setCollaborators] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [githubToken, setGithubToken] = useState<string | undefined>(undefined)

    // Fetch contributors + collaborators with a given token
    const fetchGitHubData = async (owner: string, repo: string, token?: string) => {
        const [contribs, collabs] = await Promise.all([
            getRepoContributors(owner, repo, token),
            getRepoCollaborators(owner, repo, token),
        ])
        setContributors(contribs)
        setCollaborators(collabs)
    }

    useEffect(() => {
        async function loadProject() {
            if (!id || !user) return

            const { data, error } = await supabase
                .from('projects')
                .select(`
                    *,
                    project_members (
                        project_role,
                        profiles (
                            id,
                            display_name,
                            avatar_url,
                            github_username,
                            email
                        )
                    )
                `)
                .eq('id', id)
                .single()

            if (data && !error) {
                setProject(data)

                // Token resolution: OAuth provider token > stored PAT from creation
                const token =
                    session?.provider_token ||
                    localStorage.getItem(`github_pat_${data.id}`) ||
                    undefined

                setGithubToken(token)
                await fetchGitHubData(data.github_owner, data.github_repo, token)
            }
            setLoading(false)
        }

        loadProject()
    }, [id, user])

    const handleAssignSuccess = () => {
        if (!id || !user) return
        supabase
            .from('projects')
            .select(`
                *,
                project_members (
                    project_role,
                    profiles (
                        id,
                        display_name,
                        avatar_url,
                        github_username,
                        email
                    )
                )
            `)
            .eq('id', id)
            .single()
            .then(({ data }) => {
                if (data) setProject(data)
            })
    }

    const handleDeleteProject = async () => {
        if (!project || !user) return

        const confirmed = window.confirm(
            `Are you sure you want to delete "${project.name}"? This action is permanent and will remove all associated bugs and data.`
        )

        if (!confirmed) return

        setLoading(true)
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id)

            if (error) throw error

            navigate('/')
        } catch (err: any) {
            alert(err.message)
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-8 bg-zinc-900 rounded w-1/4"></div>
                <div className="h-32 bg-zinc-900 rounded-xl"></div>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-500">
                <AlertCircle className="h-12 w-12 mb-4 text-red-500/50" />
                <h2 className="text-xl text-white mb-2">Project not found</h2>
                <p>This project may have been deleted or you don't have access.</p>
                <Link to="/" className="mt-6 text-blue-500 hover:underline">
                    Return to Dashboard
                </Link>
            </div>
        )
    }

    const isPrivate = project.github_details?.private === true

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            {project.name}
                            <span className="text-sm font-mono bg-zinc-800 text-zinc-300 px-2 py-1 rounded align-middle">
                                {project.project_code}
                            </span>
                            {isPrivate && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20 px-2 py-1 rounded-full">
                                    <Lock className="h-3 w-3" /> Private
                                </span>
                            )}
                        </h1>
                        <a
                            href={project.github_repo_url || `https://github.com/${project.github_owner}/${project.github_repo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-zinc-400 hover:text-blue-400 mt-2 text-sm transition-colors"
                        >
                            <Github className="h-4 w-4" />
                            {project.github_owner}/{project.github_repo}
                        </a>
                    </div>
                </div>

                {/* Project Actions - Only for admins/creators */}
                {(() => {
                    const userMember = project.project_members?.find(m => m.profiles.id === user?.id);
                    const userRole = userMember?.project_role;
                    const canManageProject = ['admin', 'pm'].includes(userRole || '') || project.created_by === user?.id;

                    return canManageProject && (
                        <div className="flex items-center gap-2">
                            <EditProjectModal
                                project={project}
                                userRole={userRole}
                                onSuccess={handleAssignSuccess}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeleteProject}
                                className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 gap-2 transition-all h-9"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Project
                            </Button>
                        </div>
                    );
                })()}
            </div>

            {/* GitHub Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <div className="text-zinc-500 text-sm mb-1">Stars</div>
                    <div className="text-2xl font-semibold text-white">
                        {project.github_details?.stars || 0}
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <div className="text-zinc-500 text-sm mb-1">Forks</div>
                    <div className="text-2xl font-semibold text-white">
                        {project.github_details?.forks || 0}
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <div className="text-zinc-500 text-sm mb-1">Open GitHub Issues</div>
                    <div className="text-2xl font-semibold text-white">
                        {project.github_details?.openIssues || 0}
                    </div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                    <div className="text-zinc-500 text-sm mb-1">Language</div>
                    <div className="text-2xl font-semibold text-white truncate">
                        {project.github_details?.language || 'N/A'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                {/* Main Content Area */}
                <div className="col-span-2 space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col min-h-[300px]">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <Bug className="h-4 w-4 text-red-400" />
                                Recent Bugs Tracker
                            </h2>
                            {(() => {
                                const userMember = project.project_members?.find(m => m.profiles.id === user?.id);
                                const userRole = userMember?.project_role;
                                const canCreateBug = ['admin', 'pm', 'tester'].includes(userRole || '');

                                return canCreateBug && (
                                    <CreateBugModal
                                        projectId={project.id}
                                        projectCode={project.project_code}
                                        onSuccess={handleAssignSuccess}
                                    />
                                );
                            })()}
                        </div>
                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/20">
                            <Columns className="h-12 w-12 mb-4 text-blue-500/50" />
                            <h3 className="text-lg font-medium text-white mb-2">Bug Kanban Board</h3>
                            <p className="text-center max-w-sm mb-6">
                                View and manage all bugs for this project in the dedicated Kanban Board view. Track progress from Open to Closed.
                            </p>
                            <Link
                                to={`/projects/${project.id}/board`}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white shadow hover:bg-blue-600/90 h-9 px-4 py-2 gap-2"
                            >
                                <Columns className="h-4 w-4" />
                                Open Bug Board
                            </Link>
                        </div>
                    </div>

                    {/* Tasks Board Section */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col min-h-[300px]">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-green-400" />
                                Tasks Tracker
                            </h2>
                            {(() => {
                                const userMember = project.project_members?.find(m => m.profiles.id === user?.id);
                                const userRole = userMember?.project_role;
                                const canCreateTask = ['admin', 'pm', 'tester', 'developer'].includes(userRole || '');

                                return canCreateTask && (
                                    <CreateTaskModal
                                        projectId={project.id}
                                        projectCode={project.project_code}
                                        onSuccess={handleAssignSuccess}
                                    />
                                );
                            })()}
                        </div>
                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-zinc-500 bg-zinc-950/20">
                            <Columns className="h-12 w-12 mb-4 text-green-500/50" />
                            <h3 className="text-lg font-medium text-white mb-2">Task Kanban Board</h3>
                            <p className="text-center max-w-sm mb-6">
                                View and manage all planned tasks for this project. Track progress from To Do to Done.
                            </p>
                            <Link
                                to={`/projects/${project.id}/tasks`}
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white shadow hover:bg-green-600/90 h-9 px-4 py-2 gap-2"
                            >
                                <Columns className="h-4 w-4" />
                                Open Task Board
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* App Team Members */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                App Team Members
                            </h2>
                            {project.project_members?.some(m => m.profiles.id === user?.id && ['admin', 'pm'].includes(m.project_role)) && (
                                <InviteMemberModal projectId={project.id} onSuccess={handleAssignSuccess} />
                            )}
                        </div>
                        <div className="p-4">
                            <div className="space-y-4">
                                {project.project_members?.map((member, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        {member.profiles.avatar_url ? (
                                            <img src={member.profiles.avatar_url} alt="avatar" className="h-8 w-8 rounded-full border border-zinc-700" />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-semibold text-xs border border-blue-500/30">
                                                {member.profiles.display_name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-white font-medium truncate flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 truncate">
                                                    {member.profiles.display_name}
                                                    {member.profiles.id === user?.id && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase flex-shrink-0">You</span>}
                                                </div>
                                                {project.project_members?.some(m => m.profiles.id === user?.id && ['admin', 'pm'].includes(m.project_role)) && (
                                                    <EditMemberRoleModal
                                                        projectId={project.id}
                                                        memberId={member.profiles.id}
                                                        memberName={member.profiles.display_name}
                                                        currentRole={member.project_role}
                                                        onSuccess={handleAssignSuccess}
                                                    />
                                                )}
                                            </div>
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider">{member.project_role}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* GitHub Collaborators Panel — always shown */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-amber-400" />
                                GitHub Collaborators
                                {isPrivate && <Lock className="h-3 w-3 text-amber-400/70" />}
                            </h2>
                            <span className="text-xs text-zinc-500">{collaborators.length} total</span>
                        </div>
                        <div className="p-4">
                            {collaborators.length > 0 ? (
                                <div className="space-y-3">
                                    {collaborators.map((c, i) => (
                                        <a key={i} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                                            <img src={c.avatar_url} alt="avatar" className="h-8 w-8 rounded-full border border-zinc-700 group-hover:border-zinc-500 transition-colors" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-zinc-300 font-medium truncate group-hover:text-blue-400 transition-colors flex justify-between items-center gap-2">
                                                    <span>@{c.login}</span>
                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                </div>
                                                <div className="mt-0.5">
                                                    <RoleBadge role={c.role_name} />
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-3 text-sm space-y-3">
                                    {githubToken ? (
                                        // Has a token but still no collaborators
                                        <div className="text-center text-zinc-500 space-y-1 py-2">
                                            <ShieldCheck className="h-6 w-6 mx-auto opacity-30 mb-2" />
                                            <p>No collaborators found.</p>
                                            <p className="text-xs">You may not have collaborator access to this repo.</p>
                                        </div>
                                    ) : (
                                        // No token available at all
                                        <div className="text-center text-zinc-500 py-3 space-y-1">
                                            <ShieldCheck className="h-6 w-6 mx-auto opacity-30 mb-2" />
                                            <p className="text-sm">No GitHub token found.</p>
                                            <p className="text-xs text-zinc-600">
                                                When creating a project, add a GitHub Personal Access Token
                                                with <code className="text-amber-500/80">repo</code> scope to view collaborators automatically.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top Contributors Panel — always shown */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="font-semibold text-white flex items-center gap-2">
                                <Github className="h-4 w-4" />
                                Top Contributors
                            </h2>
                            <span className="text-xs text-zinc-500">{contributors.length} shown</span>
                        </div>
                        <div className="p-4">
                            {contributors.length > 0 ? (
                                <div className="space-y-3">
                                    {contributors.map((c, i) => (
                                        <a key={i} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                                            <img src={c.avatar_url} alt="avatar" className="h-8 w-8 rounded-full border border-zinc-700 group-hover:border-zinc-500 transition-colors" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-zinc-300 font-medium truncate group-hover:text-blue-400 transition-colors flex justify-between items-center">
                                                    @{c.login}
                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="text-xs text-zinc-500">{c.contributions} commits</div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-zinc-500 text-sm">
                                    <Github className="h-6 w-6 mx-auto opacity-30 mb-2" />
                                    <p>No contributors found.</p>
                                    {isPrivate && <p className="text-xs mt-1">Private repo — contributors may require GitHub auth.</p>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
