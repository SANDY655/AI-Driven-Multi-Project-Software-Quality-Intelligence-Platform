import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Clock, AlertCircle, User as UserIcon, FileText, GitCommit, Trash2 } from 'lucide-react'
import { BugComments } from '@/components/projects/bugs/BugComments'
import { BugActivityTimeline } from '@/components/projects/bugs/BugActivityTimeline'

export function BugDetailPage() {
    const { id: projectId, bugId } = useParams<{ id: string, bugId: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [bug, setBug] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

    useEffect(() => {
        const fetchDetails = async () => {
            if (!projectId || !bugId) return

            // Fetch Project details
            const { data: projectData } = await supabase
                .from('projects')
                .select('name, project_code')
                .eq('id', projectId)
                .single()
            if (projectData) setProject(projectData)

            // Fetch Bug details
            const { data: bugData, error } = await supabase
                .from('bugs')
                .select(`
                    *,
                    reported_by_profile:reported_by (display_name, avatar_url),
                    assigned_to_profile:assigned_to (display_name, avatar_url),
                    commit_bug_links (commits (sha, message, url, author_name))
                `)
                .eq('id', bugId)
                .single()

            if (error || !bugData) {
                console.error('Error fetching bug:', error)
                navigate(`/projects/${projectId}/board`)
                return
            }

            setBug(bugData)

            // Fetch current user project role
            if (user) {
                const { data: memberData } = await supabase
                    .from('project_members')
                    .select('project_role')
                    .eq('project_id', projectId)
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (memberData) {
                    setCurrentUserRole(memberData.project_role)
                }
            }

            setLoading(false)
        }

        fetchDetails()
    }, [projectId, bugId, navigate])

    if (loading || !bug) {
        return (
            <div className="flex-1 p-8 bg-zinc-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        )
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'in_progress': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'in_review': return 'bg-purple-100 text-purple-700 border-purple-200'
            case 'resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'closed': return 'bg-zinc-100 text-zinc-700 border-zinc-200'
            default: return 'bg-zinc-100 text-zinc-700 border-zinc-200'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'P0': return 'bg-rose-100 text-rose-700'
            case 'P1': return 'bg-orange-100 text-orange-700'
            case 'P2': return 'bg-yellow-100 text-yellow-700'
            case 'P3': return 'bg-blue-100 text-blue-700'
            default: return 'bg-zinc-100 text-zinc-700'
        }
    }

    const canDelete = ['admin', 'pm'].includes(currentUserRole || '')

    const handleDeleteBug = async () => {
        if (!window.confirm('Are you sure you want to delete this bug? This action cannot be undone.')) return

        try {
            const { error } = await supabase
                .from('bugs')
                .delete()
                .eq('id', bugId)

            if (error) throw error
            navigate(`/projects/${projectId}/board`)
        } catch (error: any) {
            console.error('Error deleting bug:', error)
            alert('Failed to delete bug: ' + error.message)
        }
    }

    return (
        <div className="space-y-6 flex flex-col flex-1 min-h-0 w-full p-8 bg-zinc-50 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Link to={`/projects/${projectId}/board`} className="p-2 -ml-2 hover:bg-zinc-200 rounded-full text-zinc-500 hover:text-zinc-900 transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold text-zinc-500 tracking-widest uppercase">{project?.project_code}</span>
                            <span className="text-zinc-300">/</span>
                            <span className="text-sm font-bold text-indigo-600 tracking-widest uppercase">{bug.bug_display_id}</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
                            {bug.title}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(bug.status)}`}>
                        {bug.status.replace('_', ' ')}
                    </div>
                    {canDelete && (
                        <button
                            onClick={handleDeleteBug}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                            title="Delete Bug"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Bug
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Main Content (Left Column) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Description Card */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-zinc-100">
                        <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            Description
                        </h3>
                        <div className="prose prose-sm max-w-none text-zinc-600 whitespace-pre-wrap">
                            {bug.description || 'No description provided.'}
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-zinc-100">
                        <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                            Discussion
                        </h3>
                        <BugComments bugId={bugId!} />
                    </div>
                </div>

                {/* Sidebar (Right Column) */}
                <div className="space-y-6">
                    {/* Details Card */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-zinc-100 space-y-6">
                        <div>
                            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Attributes</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-zinc-500 block mb-1">Priority</span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${getPriorityColor(bug.priority)}`}>
                                        {bug.priority}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-500 block mb-1">Severity</span>
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800 capitalize">
                                        <AlertCircle className="w-4 h-4 text-zinc-400" />
                                        {bug.severity}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-zinc-100"></div>

                        <div>
                            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">People</h4>
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs text-zinc-500 block mb-2">Assignee</span>
                                    <div className="flex items-center gap-2">
                                        {bug.assigned_to_profile?.avatar_url ? (
                                            <img src={bug.assigned_to_profile.avatar_url} className="w-6 h-6 rounded-full" alt="avatar" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center"><UserIcon className="w-3 h-3 text-zinc-400" /></div>
                                        )}
                                        <span className="text-sm font-semibold text-zinc-800">
                                            {bug.assigned_to_profile?.display_name || 'Unassigned'}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-500 block mb-2">Reporter</span>
                                    <div className="flex items-center gap-2">
                                        {bug.reported_by_profile?.avatar_url ? (
                                            <img src={bug.reported_by_profile.avatar_url} className="w-6 h-6 rounded-full" alt="avatar" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center"><UserIcon className="w-3 h-3 text-zinc-400" /></div>
                                        )}
                                        <span className="text-sm font-semibold text-zinc-800">
                                            {bug.reported_by_profile?.display_name || 'Unknown'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full h-px bg-zinc-100"></div>

                        <div>
                            <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3">Dates</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Created</span>
                                    <span className="font-semibold text-zinc-800">{new Date(bug.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-zinc-500">Updated</span>
                                    <span className="font-semibold text-zinc-800">{new Date(bug.updated_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {bug.commit_bug_links && bug.commit_bug_links.length > 0 && (
                            <>
                                <div className="w-full h-px bg-zinc-100"></div>
                                <div>
                                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <GitCommit className="w-4 h-4" /> Commits
                                    </h4>
                                    <div className="space-y-3">
                                        {bug.commit_bug_links.map((link: any, i: number) => {
                                            const commit = link.commits
                                            return commit ? (
                                                <div key={i} className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <a href={commit.url} target="_blank" rel="noreferrer" className="text-xs font-mono font-bold text-indigo-600 hover:underline">
                                                            {commit.sha.substring(0, 7)}
                                                        </a>
                                                        <span className="text-[10px] text-zinc-400 font-medium">{commit.author_name}</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-600 truncate">{commit.message}</p>
                                                </div>
                                            ) : null
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Activity Timeline Card */}
                    <div className="bg-white rounded-[24px] p-6 shadow-sm border border-zinc-100">
                        <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-zinc-400" />
                            Activity
                        </h3>
                        <BugActivityTimeline bugId={bugId!} />
                    </div>
                </div>
            </div>
        </div>
    )
}
