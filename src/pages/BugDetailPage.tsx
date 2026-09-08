import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowUp, ArrowDown, Minus, ArrowRight, User as UserIcon, FileText, GitCommit, Trash2, Edit2, Share2, MoreHorizontal } from 'lucide-react'
import { BugComments } from '@/components/projects/bugs/BugComments'
import { BugActivityTimeline } from '@/components/projects/bugs/BugActivityTimeline'
import { BugDetailsModal } from '@/components/projects/BugDetailsModal'

export function BugDetailPage() {
    const { id: projectId, bugId } = useParams<{ id: string, bugId: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [bug, setBug] = useState<any>(null)
    const [project, setProject] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [childDuplicates, setChildDuplicates] = useState<any[]>([])
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

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

            const { data: bugData, error } = await supabase
                .from('bugs')
                .select(`
                    *,
                    reported_by_profile:reported_by (display_name, avatar_url),
                    assigned_to_profile:assigned_to (display_name, avatar_url),
                    commit_bug_links (commits (sha, message, url, author_name)),
                    duplicate_of_bug:duplicate_of (bug_display_id, title)
                `)
                .eq('id', bugId)
                .single()

            if (error || !bugData) {
                console.error('Error fetching bug:', error)
                navigate(`/projects/${projectId}/board`)
                return
            }

            setBug(bugData)

            // Fetch child duplicates
            const { data: childDups } = await supabase
                .from('bugs')
                .select('bug_display_id, title')
                .eq('duplicate_of', bugId)
            setChildDuplicates(childDups || [])

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
    }, [projectId, bugId, navigate, user])

    if (loading || !bug) {
        return (
            <div className="flex-1 p-8 bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0052CC]"></div>
            </div>
        )
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-[#DFE1E6] text-[#42526E]'
            case 'in_progress': return 'bg-[#DEEBFF] text-[#0052CC]'
            case 'in_review': return 'bg-[#EAE6FF] text-[#403294]'
            case 'resolved': return 'bg-[#E3FCEF] text-[#006644]'
            case 'closed': return 'bg-[#E3FCEF] text-[#006644]'
            default: return 'bg-[#DFE1E6] text-[#42526E]'
        }
    }

    const renderPriorityIcon = (priority: string) => {
        switch(priority) {
            case 'P0':
                return <><ArrowUp className="w-4 h-4 text-[#DE350B]" /> Highest</>
            case 'P1':
                return <><ArrowUp className="w-4 h-4 text-[#FF5630]" /> High</>
            case 'P2':
                return <><Minus className="w-4 h-4 text-[#FFAB00]" /> Medium</>
            case 'P3':
                return <><ArrowDown className="w-4 h-4 text-[#0065FF]" /> Low</>
            default:
                return <><ArrowRight className="w-4 h-4 text-[#5E6C84]" /> {priority}</>
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

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href)
        alert('Link copied to clipboard!')
    }

    const handleUpdate = () => {
        // Refresh bug data when modal updates
        window.location.reload()
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 w-full bg-white overflow-y-auto text-[#172B4D]">
            {/* Header */}
            <div className="px-10 pt-8 pb-4">
                <div className="flex items-center text-sm text-[#5E6C84] mb-4">
                    <Link to="/projects" className="hover:underline">Projects</Link>
                    <span className="mx-2">/</span>
                    <Link to={`/projects/${projectId}`} className="hover:underline">{project?.name}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-[#172B4D] hover:underline cursor-pointer">{bug.bug_display_id}</span>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-medium tracking-tight text-[#172B4D]">
                        {bug.title}
                    </h1>
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <button 
                        onClick={() => setIsEditModalOpen(true)}
                        className="bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6] px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Edit2 className="w-4 h-4" /> Edit
                    </button>
                    <button 
                        onClick={handleShare}
                        className="bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6] px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                    {canDelete && (
                        <button
                            onClick={handleDeleteBug}
                            className="bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6] px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    )}
                    <button className="bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6] px-2 py-1.5 rounded text-sm font-medium transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="px-10 pb-12 flex gap-10">
                {/* Main Content (Left Column) */}
                <div className="flex-1 space-y-8">
                    {/* Description Section */}
                    <div>
                        <h3 className="text-[16px] font-medium text-[#172B4D] mb-4">Description</h3>
                        <div className="text-sm text-[#172B4D] whitespace-pre-wrap leading-relaxed">
                            {bug.description || 'No description provided.'}
                        </div>
                    </div>

                    {/* Activity Section */}
                    <div>
                        <div className="flex items-center gap-4 mb-4 border-b border-[#DFE1E6]">
                            <button className="pb-2 border-b-2 border-[#0052CC] font-medium text-sm text-[#0052CC]">Comments</button>
                            <button className="pb-2 border-b-2 border-transparent font-medium text-sm text-[#5E6C84] hover:text-[#172B4D]">History</button>
                        </div>
                        <BugComments bugId={bugId!} />
                    </div>
                </div>

                {/* Sidebar (Right Column) */}
                <div className="w-[350px] flex-shrink-0 space-y-6">
                    {/* Details Panel */}
                    <div className="border border-[#DFE1E6] rounded">
                        <div className="p-4 border-b border-[#DFE1E6] flex justify-between items-center bg-[#FAFBFC] rounded-t">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${getStatusColor(bug.status)}`}>
                                {bug.status.replace('_', ' ')}
                            </span>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="flex">
                                <span className="w-1/3 text-sm text-[#5E6C84] font-medium">Assignee</span>
                                <div className="flex items-center gap-2 w-2/3 text-sm text-[#172B4D]">
                                    {bug.assigned_to_profile?.avatar_url ? (
                                        <img src={bug.assigned_to_profile.avatar_url} className="w-6 h-6 rounded-full" alt="avatar" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold">
                                            {bug.assigned_to_profile?.display_name?.charAt(0) || <UserIcon className="w-3 h-3" />}
                                        </div>
                                    )}
                                    <span className="hover:text-[#0052CC] hover:underline cursor-pointer">{bug.assigned_to_profile?.display_name || 'Unassigned'}</span>
                                </div>
                            </div>
                            <div className="flex">
                                <span className="w-1/3 text-sm text-[#5E6C84] font-medium">Reporter</span>
                                <div className="flex items-center gap-2 w-2/3 text-sm text-[#172B4D]">
                                    {bug.reported_by_profile?.avatar_url ? (
                                        <img src={bug.reported_by_profile.avatar_url} className="w-6 h-6 rounded-full" alt="avatar" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold">
                                            {bug.reported_by_profile?.display_name?.charAt(0) || <UserIcon className="w-3 h-3" />}
                                        </div>
                                    )}
                                    <span className="hover:text-[#0052CC] hover:underline cursor-pointer">{bug.reported_by_profile?.display_name || 'Unknown'}</span>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className="w-1/3 text-sm text-[#5E6C84] font-medium">Priority</span>
                                <div className="flex items-center gap-1.5 w-2/3 text-sm text-[#172B4D]">
                                    {renderPriorityIcon(bug.priority)}
                                </div>
                            </div>
                            <div className="flex items-center">
                                <span className="w-1/3 text-sm text-[#5E6C84] font-medium">Severity</span>
                                <div className="w-2/3 text-sm text-[#172B4D] capitalize">
                                    {bug.severity}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-[#DFE1E6] rounded">
                        <div className="p-4 border-b border-[#DFE1E6] bg-[#FAFBFC] rounded-t font-medium text-[#172B4D] text-sm">
                            Dates
                        </div>
                        <div className="p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-[#5E6C84]">Created</span>
                                <span className="text-[#172B4D]">{new Date(bug.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-[#5E6C84]">Updated</span>
                                <span className="text-[#172B4D]">{new Date(bug.updated_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    {bug.commit_bug_links && bug.commit_bug_links.length > 0 && (
                        <div className="border border-[#DFE1E6] rounded">
                            <div className="p-4 border-b border-[#DFE1E6] bg-[#FAFBFC] rounded-t font-medium text-[#172B4D] text-sm flex items-center gap-2">
                                <GitCommit className="w-4 h-4" /> Development
                            </div>
                            <div className="p-4 space-y-3">
                                {bug.commit_bug_links.map((link: any, i: number) => {
                                    const commit = link.commits
                                    return commit ? (
                                        <div key={i} className="text-sm">
                                            <a href={commit.url} target="_blank" rel="noreferrer" className="font-mono text-[#0052CC] hover:underline mr-2">
                                                {commit.sha.substring(0, 7)}
                                            </a>
                                            <span className="text-[#172B4D]">{commit.message}</span>
                                        </div>
                                    ) : null
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && (
                <BugDetailsModal 
                    bugId={bugId!}
                    projectId={projectId!}
                    userRole={currentUserRole || undefined}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={handleUpdate}
                />
            )}
        </div>
    )
}
