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
import { Github, Users, Bug, AlertCircle, Trash2, ExternalLink, CheckSquare, Lock, ShieldCheck, Activity } from 'lucide-react'

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
    admin: { label: 'Admin', color: 'bg-[#FFEBE6] text-[#DE350B]' },
    owner: { label: 'Owner', color: 'bg-[#EAE6FF] text-[#403294]' },
    write: { label: 'Write', color: 'bg-[#DEEBFF] text-[#0052CC]' },
    maintain: { label: 'Maintain', color: 'bg-[#FFFAE6] text-[#FF8B00]' },
    triage: { label: 'Triage', color: 'bg-[#EBECF0] text-[#42526E]' },
    read: { label: 'Read', color: 'bg-[#EBECF0] text-[#42526E]' },
}

function RoleBadge({ role }: { role: string }) {
    const badge = ROLE_BADGE[role] ?? { label: role, color: 'bg-[#EBECF0] text-[#42526E]' }
    return (
        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded uppercase ${badge.color}`}>
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
            <div className="flex-1 p-8 text-[#172B4D] animate-pulse">
                <div className="h-4 bg-[#EBECF0] w-32 rounded mb-4"></div>
                <div className="h-8 bg-[#EBECF0] w-64 rounded mb-8"></div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 h-64 bg-[#EBECF0] rounded"></div>
                    <div className="col-span-1 h-64 bg-[#EBECF0] rounded"></div>
                </div>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <AlertCircle className="h-12 w-12 text-[#FF5630] mb-4" />
                <h2 className="text-xl font-medium text-[#172B4D] mb-2">Project not found</h2>
                <p className="text-[#5E6C84] mb-6">This project may have been deleted or you don't have access.</p>
                <Link to="/" className="text-[#0052CC] hover:underline font-medium">Return to Dashboard</Link>
            </div>
        )
    }

    const isPrivate = project.github_details?.private === true

    return (
        <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 text-[#172B4D]">
            {/* Breadcrumbs */}
            <div className="flex items-center text-sm text-[#5E6C84] mb-4">
                <Link to="/" className="hover:underline">Projects</Link>
                <span className="mx-2">/</span>
                <span className="text-[#172B4D]">{project.name}</span>
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-[#EAE6FF] text-[#403294] flex items-center justify-center font-bold text-lg">
                        {project.project_code.substring(0, 2)}
                    </div>
                    <div>
                        <h1 className="text-2xl font-medium tracking-tight flex items-center gap-2">
                            {project.name}
                            {isPrivate && <Lock className="w-4 h-4 text-[#FF8B00]" />}
                        </h1>
                        <p className="text-sm text-[#5E6C84]">{project.project_code} • Software project</p>
                    </div>
                </div>
                
                {/* Project Actions */}
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
                                onClick={handleDeleteProject}
                                className="bg-[#FAFBFC] border-[#DFE1E6] text-[#42526E] hover:bg-[#FFEBE6] hover:text-[#DE350B] hover:border-[#DE350B] h-8 px-3 transition-colors"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </Button>
                        </div>
                    );
                })()}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Column (Main content) */}
                <div className="col-span-2 space-y-8">
                    
                    {/* Activity/Quick Actions */}
                    <div>
                        <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border border-[#DFE1E6] rounded p-5 hover:shadow-[0_1px_4px_rgba(9,30,66,0.15)] transition-shadow bg-white flex flex-col items-start cursor-pointer" onClick={() => navigate(`/projects/${project.id}/board`)}>
                                <div className="w-8 h-8 rounded bg-[#EAE6FF] text-[#403294] flex items-center justify-center mb-3">
                                    <Bug className="w-4 h-4" />
                                </div>
                                <h3 className="font-medium text-[#172B4D] mb-1">Bug Tracker</h3>
                                <p className="text-xs text-[#5E6C84] mb-4">View open bugs and issues</p>
                                <div onClick={e => e.stopPropagation()}>
                                    <CreateBugModal projectId={project.id} projectCode={project.project_code} onSuccess={handleAssignSuccess} />
                                </div>
                            </div>
                            
                            <div className="border border-[#DFE1E6] rounded p-5 hover:shadow-[0_1px_4px_rgba(9,30,66,0.15)] transition-shadow bg-white flex flex-col items-start cursor-pointer" onClick={() => navigate(`/projects/${project.id}/tasks`)}>
                                <div className="w-8 h-8 rounded bg-[#E3FCEF] text-[#006644] flex items-center justify-center mb-3">
                                    <CheckSquare className="w-4 h-4" />
                                </div>
                                <h3 className="font-medium text-[#172B4D] mb-1">Task Board</h3>
                                <p className="text-xs text-[#5E6C84] mb-4">Manage planned tasks</p>
                                <div onClick={e => e.stopPropagation()}>
                                    <CreateTaskModal projectId={project.id} projectCode={project.project_code} onSuccess={handleAssignSuccess} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div>
                        <h2 className="text-lg font-medium mb-4">Details</h2>
                        <div className="border border-[#DFE1E6] rounded bg-white p-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1">Repository</p>
                                    <a href={project.github_repo_url || `https://github.com/${project.github_owner}/${project.github_repo}`} target="_blank" rel="noreferrer" className="text-sm text-[#0052CC] hover:underline flex items-center gap-1">
                                        <Github className="w-3.5 h-3.5" />
                                        {project.github_repo}
                                    </a>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1">Language</p>
                                    <p className="text-sm font-medium">{project.github_details?.language || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1">Stars</p>
                                    <p className="text-sm font-medium">{project.github_details?.stars || 0}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-1">Forks</p>
                                    <p className="text-sm font-medium">{project.github_details?.forks || 0}</p>
                                </div>
                            </div>
                            {project.description && (
                                <div className="mt-6 pt-4 border-t border-[#DFE1E6]">
                                    <p className="text-xs font-bold text-[#5E6C84] uppercase tracking-wider mb-2">Description</p>
                                    <p className="text-sm text-[#172B4D]">{project.description}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column (Sidebar) */}
                <div className="space-y-6">
                    {/* Team Members */}
                    <div className="border border-[#DFE1E6] rounded bg-white">
                        <div className="p-4 border-b border-[#DFE1E6] flex justify-between items-center bg-[#FAFBFC] rounded-t">
                            <h2 className="font-medium text-[#172B4D] flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#5E6C84]" />
                                Team
                            </h2>
                            {project.project_members?.some(m => m.profiles.id === user?.id && ['admin', 'pm'].includes(m.project_role)) && (
                                <InviteMemberModal projectId={project.id} onSuccess={handleAssignSuccess} />
                            )}
                        </div>
                        <div className="p-4 space-y-4">
                            {project.project_members?.map((member, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    {member.profiles.avatar_url ? (
                                        <img src={member.profiles.avatar_url} alt="avatar" className="w-8 h-8 rounded-full" />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-xs">
                                            {member.profiles.display_name?.charAt(0) || '?'}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-[#172B4D] truncate">{member.profiles.display_name}</span>
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
                                        <span className="text-xs text-[#5E6C84] uppercase font-bold tracking-wider">{member.project_role}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* GitHub Collaborators */}
                    <div className="border border-[#DFE1E6] rounded bg-white">
                        <div className="p-4 border-b border-[#DFE1E6] flex items-center justify-between bg-[#FAFBFC] rounded-t">
                            <h2 className="font-medium text-[#172B4D] flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-[#5E6C84]" />
                                Collaborators
                            </h2>
                            <span className="text-xs font-bold bg-[#EBECF0] text-[#42526E] px-2 py-0.5 rounded-full">{collaborators.length}</span>
                        </div>
                        <div className="p-4">
                            {collaborators.length > 0 ? (
                                <div className="space-y-3">
                                    {collaborators.map((c, i) => (
                                        <a key={i} href={c.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
                                            <img src={c.avatar_url} alt="avatar" className="w-6 h-6 rounded-full" />
                                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                                <span className="text-sm text-[#172B4D] group-hover:text-[#0052CC] hover:underline truncate">@{c.login}</span>
                                                <RoleBadge role={c.role_name} />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-[#5E6C84]">No collaborators found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
