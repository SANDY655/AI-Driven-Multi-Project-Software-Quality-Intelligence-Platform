import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem
} from '@/components/ui/dropdown-menu'
import { X, UserPlus, Loader2, GitBranch, GitCommit, Clock, Github, FileCode2, Trash2, ArrowUp, ArrowDown, Minus, ChevronDown } from 'lucide-react'
import { ConnectGithubModal } from './dev-tools/ConnectGithubModal'
import { CreateBranchModal } from './dev-tools/CreateBranchModal'
import { CreateCommitModal } from './dev-tools/CreateCommitModal'
import { SubTasksChecklist } from './SubTasksChecklist'
import { LogWorkModal, formatMinutes } from './LogWorkModal'
import { IssueLinkManager } from './IssueLinkManager'

interface BugDetailsModalProps {
    bugId: string | null
    projectId: string
    userRole?: string
    onClose: () => void
    onUpdate: () => void
}

export function BugDetailsModal({ bugId, projectId, userRole: initialUserRole, onClose, onUpdate }: BugDetailsModalProps) {
    const { user } = useAuth()
    const [bug, setBug] = useState<any>(null)
    const [comments, setComments] = useState<any[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(true)
    const { session } = useAuth()
    const [project, setProject] = useState<any>(null)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [commentError, setCommentError] = useState<string | null>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(initialUserRole)
    const [logWorkOpen, setLogWorkOpen] = useState(false)
    const [logWorkTime, setLogWorkTime] = useState('')
    const [branches, setBranches] = useState<any[]>([])
    const [commits, setCommits] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    
    // Dev Tools modals
    const [connectGithubOpen, setConnectGithubOpen] = useState(false)
    const [createBranchOpen, setCreateBranchOpen] = useState(false)
    const [createCommitOpen, setCreateCommitOpen] = useState(false)
    

    const canEditAll = ['admin', 'pm', 'tester'].includes(currentUserRole || '')
    const canEditStatus = ['admin', 'pm', 'tester', 'developer'].includes(currentUserRole || '')
    const canDelete = ['admin', 'pm'].includes(currentUserRole || '')

    useEffect(() => {
        if (!bugId) return
        loadData()
    }, [bugId])

    async function loadData() {
        setLoading(true)

        const { data: bugData, error: bugError } = await supabase
            .from('bugs')
            .select(`
                *,
                reporter:profiles!bugs_reported_by_fkey (display_name, avatar_url),
                assignee:profiles!bugs_assigned_to_fkey (display_name, avatar_url)
            `)
            .eq('id', bugId)
            .single()

        if (bugError) console.error("Error loading bug:", bugError)
        setBug(bugData)

        const { data: membersData } = await supabase
            .from('project_members')
            .select(`
                project_role,
                profiles (id, display_name, avatar_url, email)
            `)
            .eq('project_id', projectId)

        if (membersData) {
            setMembers(membersData.map((m: any) => ({ ...m.profiles, role: m.project_role })))
            const meta = membersData.find((m: any) => m.profiles.id === user?.id)
            if (meta) setCurrentUserRole(meta.project_role)
        }

        const { data: commentsData } = await supabase
            .from('bug_comments')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('bug_id', bugId)
            .order('created_at', { ascending: true })

        setComments(commentsData || [])

        const { data: epicsData } = await supabase
            .from('epics')
            .select('id, name')
            .eq('project_id', projectId)
        
        setEpics(epicsData || [])

        const { data: projData } = await supabase
            .from('projects')
            .select('github_owner, github_repo')
            .eq('id', projectId)
            .single()
            
        if (projData) setProject(projData)

        // Load development links
        const { data: branchesData } = await supabase
            .from('branch_bug_links')
            .select('branches(*)')
            .eq('bug_id', bugId)
        
        if (branchesData) {
            setBranches(branchesData.map((d: any) => d.branches).filter(Boolean))
        }

        const { data: commitsData } = await supabase
            .from('commit_bug_links')
            .select('commits(*)')
            .eq('bug_id', bugId)
        
        if (commitsData) {
            setCommits(commitsData.map((d: any) => d.commits).filter(Boolean))
        }

        setLoading(false)
    }

    // SLA Calculation
    const getSLADetails = () => {
        if (!bug) return null
        let slaHours = 0
        switch (bug.priority) {
            case 'P0': slaHours = 24; break;
            case 'P1': slaHours = 48; break;
            case 'P2': slaHours = 24 * 7; break;
            case 'P3': slaHours = 24 * 14; break;
            default: slaHours = 48;
        }

        const createdTime = new Date(bug.created_at).getTime()
        const deadlineTime = createdTime + (slaHours * 60 * 60 * 1000)
        
        if (bug.resolved_at) {
            const resolvedTime = new Date(bug.resolved_at).getTime()
            return {
                status: resolvedTime <= deadlineTime ? 'met' : 'breached_resolved',
                text: resolvedTime <= deadlineTime ? 'SLA Met' : 'SLA Breached',
                color: resolvedTime <= deadlineTime ? 'text-[#006644] bg-[#E3FCEF]' : 'text-[#DE350B] bg-[#FFEBE6]'
            }
        }

        const now = new Date().getTime()
        const remaining = deadlineTime - now

        if (remaining < 0) {
            const hoursBreached = Math.floor(Math.abs(remaining) / (1000 * 60 * 60))
            return {
                status: 'breached',
                text: `Breached by ${hoursBreached}h`,
                color: 'text-[#DE350B] bg-[#FFEBE6]'
            }
        }

        const hoursLeft = Math.floor(remaining / (1000 * 60 * 60))
        if (hoursLeft < 24) {
            return {
                status: 'warning',
                text: `${hoursLeft}h remaining`,
                color: 'text-[#FF8B00] bg-[#FFFAE6]'
            }
        }
        
        const daysLeft = Math.floor(hoursLeft / 24)
        return {
            status: 'ok',
            text: `${daysLeft}d remaining`,
            color: 'text-[#0052CC] bg-[#DEEBFF]'
        }
    }

    async function handleLogWork() {
        if (!bug || !bugId || !logWorkTime) return
        
        const timeStr = logWorkTime.toLowerCase()
        let minutes = 0
        const hoursMatch = timeStr.match(/(\d+)\s*h/)
        const minsMatch = timeStr.match(/(\d+)\s*m/)
        
        if (hoursMatch) minutes += parseInt(hoursMatch[1]) * 60
        if (minsMatch) minutes += parseInt(minsMatch[1])
        
        if (!hoursMatch && !minsMatch && !isNaN(parseInt(timeStr))) {
            minutes += parseInt(timeStr)
        }

        if (minutes > 0) {
            const newTotal = (bug.time_spent || 0) + minutes
            await updateField('time_spent', newTotal.toString())
            setLogWorkOpen(false)
            setLogWorkTime('')
        }
    }

    async function handleAddComment() {
        if (!newComment.trim() || !user || !bugId) return
        setSubmittingComment(true)
        setCommentError(null)

        const { error } = await supabase
            .from('bug_comments')
            .insert({
                bug_id: bugId,
                user_id: user.id,
                content: newComment
            })

        if (error) {
            console.error("Error adding comment:", error)
            setCommentError(error.message)
        } else {
            setNewComment('')
            loadData()
        }
        setSubmittingComment(false)
    }

    async function updateField(field: string, value: string | null) {
        if (!bug || !bugId || bug[field] === value) return
        const oldValue = bug[field]

        const updatePayload: any = {}
        updatePayload[field] = value

        // Check for resolution
        const isResolving = (field === 'status' && (value === 'resolved' || value === 'closed'))
        const isUnresolving = (field === 'status' && (value !== 'resolved' && value !== 'closed') && (bug.status === 'resolved' || bug.status === 'closed'))
        
        let extraUpdate: any = {}
        if (isResolving && !bug.resolved_at) {
            extraUpdate = { resolved_at: new Date().toISOString() }
        } else if (isUnresolving) {
            extraUpdate = { resolved_at: null }
        }

        // Automation Rule 1: Auto-assign on "In Progress" if currently unassigned
        if (field === 'status' && value === 'in_progress' && user?.id && !bug.assigned_to) {
            extraUpdate.assigned_to = user.id
        }

        const { error } = await supabase
            .from('bugs')
            .update({ ...updatePayload, [field]: field === 'story_points' || field === 'original_estimate' || field === 'time_spent' ? parseInt(value as string) || 0 : value, ...extraUpdate })
            .eq('id', bugId)

        if (!error) {
            if (field === 'duplicate_of' && value) {
                const { mergeDuplicateBug } = await import('@/lib/bug-actions')
                await mergeDuplicateBug(bugId, bug.bug_display_id, value, user?.id || '')
            }

            await supabase
                .from('activity_log')
                .insert({
                    bug_id: bugId,
                    user_id: user?.id,
                    action: `${field}_changed`,
                    old_value: oldValue ? oldValue.toString() : 'None',
                    new_value: value ? value.toString() : 'None'
                })

            setBug({ ...bug, ...updatePayload, [field]: field === 'story_points' || field === 'original_estimate' || field === 'time_spent' ? parseInt(value as string) || 0 : value, ...extraUpdate })
            onUpdate()
            loadData()
        }
    }

    async function handleDeleteBug() {
        if (!bugId || !canDelete) return
        if (!window.confirm('Are you sure you want to delete this bug? This action cannot be undone.')) return

        const { error } = await supabase
            .from('bugs')
            .delete()
            .eq('id', bugId)

        if (!error) {
            onUpdate()
            onClose()
        } else {
            alert('Failed to delete bug: ' + error.message)
        }
    }

    if (!bugId) return null

    const selectClasses = "w-full bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] border-transparent transition-colors rounded-[3px] focus:ring-[#4C9AFF]"

    return (
        <Dialog open={!!bugId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-[1040px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px]">
                <DialogDescription className="sr-only">Bug Details</DialogDescription>
                {loading || !bug ? (
                    <div className="flex-1 flex items-center justify-center bg-[#FAFBFC]">
                        <Loader2 className="h-8 w-8 animate-spin text-[#0052CC]" />
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-4 flex flex-col gap-3 flex-shrink-0 border-b border-[#DFE1E6] bg-[#FAFBFC]">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col gap-1">
                                    <div className="text-[12px] font-medium text-[#5E6C84] flex items-center gap-2">
                                        <span>{bug.bug_display_id}</span>
                                        <span className="text-[#DFE1E6]">•</span>
                                        <span className="capitalize text-[#42526E]">{bug.priority} Priority</span>
                                        <span className="text-[#DFE1E6]">•</span>
                                        <span className="capitalize text-[#DE350B] font-semibold">{bug.severity} Severity</span>
                                    </div>
                                    <DialogTitle className="text-2xl font-semibold text-[#172B4D]">
                                        {bug.title}
                                    </DialogTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    {canDelete && (
                                        <button
                                            onClick={handleDeleteBug}
                                            className="p-2 text-[#5E6C84] hover:text-[#DE350B] hover:bg-[#FFEBE6] rounded-[3px] transition-colors"
                                            title="Delete Bug"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={onClose}
                                        className="p-2 text-[#5E6C84] hover:text-[#172B4D] hover:bg-[#EBECF0] rounded-[3px] transition-colors"
                                        title="Close"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Jira Workflow Stepper & Quick Action Transition Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider mr-1">Workflow State:</span>
                                <div className="flex items-center gap-1 bg-white p-1 rounded border border-[#DFE1E6]">
                                    {[
                                        { id: 'open', label: 'Open' },
                                        { id: 'in_progress', label: 'In Progress' },
                                        { id: 'resolved', label: 'Resolved' },
                                        { id: 'closed', label: 'Closed' }
                                    ].map((step) => {
                                        const isActive = bug.status === step.id
                                        return (
                                            <button
                                                key={step.id}
                                                onClick={() => updateField('status', step.id)}
                                                className={`px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
                                                    isActive
                                                        ? 'bg-[#0052CC] text-white shadow-xs font-bold'
                                                        : 'text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]'
                                                }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-[#A5ADBA]'}`}></span>
                                                {step.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
                            <div className="w-[65%] flex flex-col h-full overflow-y-auto border-r border-[#DFE1E6] p-6 space-y-8 no-scrollbar bg-white">
                                <section>
                                    <h3 className="text-[14px] font-semibold text-[#172B4D] mb-4">
                                        Description
                                    </h3>
                                    <div className="text-[#172B4D] whitespace-pre-wrap text-sm leading-relaxed p-2 -mx-2 hover:bg-[#FAFBFC] rounded transition-colors cursor-text">
                                        {bug.description || 'No description provided.'}
                                    </div>
                                </section>

                                 {/* Issue Linking Section */}
                                 <section className="mb-6 p-3 bg-[#FAFBFC] border border-[#DFE1E6] rounded">
                                     <IssueLinkManager
                                         ticketId={bug.id}
                                         ticketType="bug"
                                         ticketDisplayId={bug.bug_display_id}
                                         currentLabels={bug.labels || []}
                                         onLinksUpdated={loadData}
                                     />
                                 </section>

                                <section className="flex-1 flex flex-col">
                                    <h3 className="text-[14px] font-semibold text-[#172B4D] mb-4">
                                        Activity
                                    </h3>

                                    <div className="flex-1 overflow-y-auto mb-6 pr-2 no-scrollbar min-h-[200px]">
                                        <div className="space-y-6">
                                            {comments.map(c => (
                                                <div key={c.id} className="flex gap-4">
                                                    <div className="flex-shrink-0 mt-1">
                                                        {c.profiles?.avatar_url ? (
                                                            <img src={c.profiles.avatar_url} className="h-8 w-8 rounded-full" alt="avatar" />
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-[11px]">
                                                                {c.profiles?.display_name?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[14px] font-semibold text-[#172B4D]">{c.profiles?.display_name}</span>
                                                            <span className="text-[12px] text-[#5E6C84]">
                                                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-[#172B4D] whitespace-pre-wrap leading-relaxed">{c.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {comments.length === 0 && (
                                                <div className="text-[14px] text-[#5E6C84]">No comments yet.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex gap-4">
                                        {user?.user_metadata?.avatar_url ? (
                                            <img src={user.user_metadata.avatar_url} className="h-8 w-8 rounded-full" alt="avatar" />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-1">
                                                {user?.email?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div className="flex-1 border border-[#DFE1E6] rounded-[3px] overflow-hidden focus-within:border-[#4C9AFF] focus-within:ring-1 focus-within:ring-[#4C9AFF]">
                                            <Textarea
                                                placeholder="Add a comment..."
                                                value={newComment}
                                                onChange={(e) => {
                                                    setNewComment(e.target.value)
                                                    if (commentError) setCommentError(null)
                                                }}
                                                className="min-h-[80px] bg-white border-none text-[#172B4D] resize-y focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none text-sm"
                                            />
                                            <div className="bg-[#FAFBFC] border-t border-[#DFE1E6] px-3 py-2 flex items-center justify-between">
                                                <span className="text-xs text-[#DE350B]">{commentError}</span>
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        disabled={submittingComment || !newComment.trim()}
                                                        onClick={handleAddComment}
                                                        className="bg-[#0052CC] hover:bg-[#0047B3] disabled:opacity-50 text-white rounded-[3px] px-4 py-1.5 font-medium text-sm transition-colors flex items-center gap-2"
                                                    >
                                                        {submittingComment && <Loader2 className="h-3 w-3 animate-spin" />}
                                                        Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <div className="w-[35%] p-6 flex flex-col h-full overflow-y-auto no-scrollbar space-y-6">
                                <div className="space-y-1">
                                    <Select
                                        value={bug.status}
                                        onValueChange={(val) => updateField('status', val)}
                                        disabled={!canEditStatus}
                                    >
                                        <SelectTrigger className="w-fit bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] font-medium border-none h-8 text-[12px] uppercase">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">OPEN</SelectItem>
                                            <SelectItem value="in_progress">IN PROGRESS</SelectItem>
                                            <SelectItem value="in_review">IN REVIEW</SelectItem>
                                            <SelectItem value="resolved">RESOLVED</SelectItem>
                                            <SelectItem value="closed">CLOSED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="border border-[#DFE1E6] rounded-[3px]">
                                    <div className="p-3 border-b border-[#DFE1E6] font-medium text-[14px] text-[#172B4D]">
                                        Details
                                    </div>
                                    <div className="p-3 space-y-4">
                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Assignee</label>
                                            <div className="w-2/3">
                                                <Select
                                                    value={bug.assigned_to || 'unassigned'}
                                                    onValueChange={(val) => updateField('assigned_to', val === 'unassigned' ? null : val)}
                                                    disabled={!canEditAll}
                                                >
                                                    <SelectTrigger className={selectClasses}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned" className="text-[#5E6C84]">Unassigned</SelectItem>
                                                        {members.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                <div className="flex items-center gap-2">
                                                                    {m.avatar_url ? (
                                                                        <img src={m.avatar_url} className="h-5 w-5 rounded-full" />
                                                                    ) : (
                                                                        <UserPlus className="h-4 w-4 text-[#5E6C84]" />
                                                                    )}
                                                                    {m.display_name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Priority</label>
                                            <div className="w-2/3">
                                                <Select
                                                    value={bug.priority}
                                                    onValueChange={(val) => updateField('priority', val)}
                                                    disabled={!canEditAll}
                                                >
                                                    <SelectTrigger className={selectClasses}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="P0"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#DE350B]" /> Highest</div></SelectItem>
                                                        <SelectItem value="P1"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#FF5630]" /> High</div></SelectItem>
                                                        <SelectItem value="P2"><div className="flex items-center gap-2"><Minus className="w-4 h-4 text-[#FFAB00]" /> Medium</div></SelectItem>
                                                        <SelectItem value="P3"><div className="flex items-center gap-2"><ArrowDown className="w-4 h-4 text-[#0065FF]" /> Low</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Severity</label>
                                            <div className="w-2/3">
                                                <Select
                                                    value={bug.severity}
                                                    onValueChange={(val) => updateField('severity', val)}
                                                    disabled={!canEditAll}
                                                >
                                                    <SelectTrigger className={selectClasses}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="critical">Critical</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="low">Low</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3 flex items-center gap-1">
                                                Story Points
                                                <span title="Relative effort score — not hours! Common scale: 1=trivial, 3=small, 5=medium, 8=large, 13=very complex. Used for sprint planning." className="cursor-help text-[#A5ADBA] hover:text-[#5E6C84] text-[10px] border border-[#A5ADBA] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold flex-shrink-0">?</span>
                                            </label>
                                            <div className="w-2/3">
                                                <input 
                                                    type="number" 
                                                    value={bug.story_points === '' || bug.story_points == null ? '' : Number(bug.story_points)} 
                                                    onChange={(e) => setBug({ ...bug, story_points: e.target.value === '' ? '' : e.target.value })}
                                                    onBlur={(e) => updateField('story_points', e.target.value)}
                                                    className={`${selectClasses} px-3 py-1.5 outline-none`}
                                                    placeholder="0"
                                                    disabled={!canEditAll}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Epic Link</label>
                                            <div className="w-2/3">
                                                <Select
                                                    value={bug.epic_id || 'unassigned'}
                                                    onValueChange={(val) => updateField('epic_id', val === 'unassigned' ? null : val)}
                                                    disabled={!canEditAll}
                                                >
                                                    <SelectTrigger className={selectClasses}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="unassigned" className="text-[#5E6C84]">None</SelectItem>
                                                        {epics.map(e => (
                                                            <SelectItem key={e.id} value={e.id}>
                                                                {e.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3 flex items-center gap-1">
                                                SLA <Clock className="w-3 h-3" />
                                                <span title="Service Level Agreement — a time deadline to resolve this bug based on priority. P0=24h, P1=48h, P2=1 week, P3=2 weeks. Red means breached, orange means warning (<24h left)." className="cursor-help text-[#A5ADBA] hover:text-[#5E6C84] text-[10px] border border-[#A5ADBA] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold flex-shrink-0">?</span>
                                            </label>
                                            <div className="w-2/3">
                                                {(() => {
                                                    const sla = getSLADetails()
                                                    if (!sla) return <span className="text-xs text-[#5E6C84]">-</span>
                                                    return (
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[11px] font-bold ${sla.color}`}>
                                                            {sla.text}
                                                        </span>
                                                    )
                                                })()}
                                            </div>
                                        </div>

                                        {/* Jira Time Tracking Section */}
                                        <div className="pt-2 border-t border-[#DFE1E6]">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-[12px] font-semibold text-[#5E6C84] flex items-center gap-1">
                                                    Time Tracking <Clock className="w-3 h-3 text-[#0747A6]" />
                                                </label>
                                                <button
                                                    onClick={() => setLogWorkOpen(true)}
                                                    className="text-[11px] font-bold text-[#0747A6] hover:underline"
                                                >
                                                    + Log Work
                                                </button>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="w-full bg-[#DFE1E6] h-2 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="bg-[#00875A] h-full"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                (bug.original_estimate || 0) > 0
                                                                    ? ((bug.time_spent || 0) / (bug.original_estimate || 1)) * 100
                                                                    : 0
                                                            )}%`
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-[11px] text-[#5E6C84]">
                                                    <span>Logged: <strong>{formatMinutes(bug.time_spent || 0)}</strong></span>
                                                    <span>Est: <strong>{formatMinutes(bug.original_estimate || 0)}</strong></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-[#DFE1E6] rounded-[3px]">
                                    <div className="p-3 border-b border-[#DFE1E6] font-medium text-[14px] text-[#172B4D]">
                                        Development
                                    </div>
                                    <div className="p-3 space-y-4">
                                        {branches.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[12px] font-semibold text-[#5E6C84]">Branches</div>
                                                {branches.map(b => (
                                                    <div key={b.id} className="flex items-center gap-2 text-sm">
                                                        <GitBranch className="w-4 h-4 text-[#5E6C84]" />
                                                        <span className="text-[#0052CC] hover:underline cursor-pointer truncate">{b.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {commits.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-[12px] font-semibold text-[#5E6C84]">Commits</div>
                                                {commits.map(c => (
                                                    <div key={c.id} className="flex items-center justify-between text-sm group">
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <GitCommit className="w-4 h-4 text-[#5E6C84]" />
                                                            <span className="text-[#0052CC] hover:underline cursor-pointer truncate" title={c.message}>{c.message}</span>
                                                        </div>
                                                        <span className="text-xs text-[#5E6C84] font-mono shrink-0 ml-2">{c.sha}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <div className="flex flex-col gap-2 pt-2 border-t border-[#DFE1E6]">
                                            {(() => {
                                                const githubToken = session?.provider_token || localStorage.getItem(`github_pat_${projectId}`)
                                                const isGithubConnected = !!githubToken && !!project?.github_owner && !!project?.github_repo

                                                if (!isGithubConnected && project?.github_owner) {
                                                    return (
                                                        <button 
                                                            onClick={() => setConnectGithubOpen(true)}
                                                            className="text-sm bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-3 py-1.5 rounded-[3px] font-medium transition-colors border border-[#DFE1E6] flex items-center justify-center gap-2"
                                                        >
                                                            <Github className="w-4 h-4 text-[#5E6C84]" />
                                                            Connect GitHub
                                                        </button>
                                                    )
                                                }

                                                return (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <button 
                                                                onClick={() => setCreateBranchOpen(true)}
                                                                disabled={!isGithubConnected}
                                                                className="text-[13px] bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-2 py-1.5 rounded-[3px] font-medium transition-colors border border-[#DFE1E6] flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                <GitBranch className="w-3.5 h-3.5 text-[#5E6C84]" />
                                                                Create branch
                                                            </button>
                                                            <button 
                                                                onClick={() => setCreateCommitOpen(true)}
                                                                disabled={!isGithubConnected}
                                                                className="text-[13px] bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-2 py-1.5 rounded-[3px] font-medium transition-colors border border-[#DFE1E6] flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                            >
                                                                <GitCommit className="w-3.5 h-3.5 text-[#5E6C84]" />
                                                                Create commit
                                                            </button>
                                                        </div>
                                                        {isGithubConnected && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="w-full text-[13px] bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-2 py-1.5 rounded-[3px] font-medium transition-colors border border-[#DFE1E6] flex items-center justify-between mt-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <FileCode2 className="w-3.5 h-3.5 text-[#5E6C84]" />
                                                                            Open in coding tool
                                                                        </div>
                                                                        <ChevronDown className="w-3.5 h-3.5 text-[#5E6C84]" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-[320px] p-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] border-none mt-1">
                                                                    <div className="p-4 border-b border-[#DFE1E6]">
                                                                        <h4 className="text-[14px] font-medium text-[#172B4D] mb-1">Open in coding tool</h4>
                                                                        <p className="text-[12px] text-[#5E6C84] leading-relaxed">
                                                                            Clone and open this repo in your preferred editor.
                                                                        </p>
                                                                    </div>
                                                                    <div className="p-2 max-h-[280px] overflow-y-auto">
                                                                        <div className="text-[11px] font-bold text-[#5E6C84] uppercase px-2 mb-1 mt-1">Select tool</div>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`vscode://vscode.git/clone?url=https://github.com/${project.github_owner}/${project.github_repo}.git`}
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://code.visualstudio.com/favicon.ico" className="w-4 h-4" alt="VS Code" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">VS Code</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">Microsoft</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`cursor://vscode.git/clone?url=https://github.com/${project.github_owner}/${project.github_repo}.git`}
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://www.cursor.com/favicon.ico" className="w-4 h-4" alt="Cursor" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">Cursor</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">AI-first editor</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`windsurf://vscode.git/clone?url=https://github.com/${project.github_owner}/${project.github_repo}.git`}
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://codeium.com/favicon.ico" className="w-4 h-4" alt="Windsurf" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">Windsurf</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">Codeium</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`jetbrains://idea/checkout/git?idea.required.plugins.id=Git4Idea&checkout.repo=https://github.com/${project.github_owner}/${project.github_repo}.git`}
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://www.jetbrains.com/favicon.ico" className="w-4 h-4" alt="IntelliJ" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">IntelliJ IDEA</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">JetBrains</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`webstorm://open?url=https://github.com/${project.github_owner}/${project.github_repo}`}
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://www.jetbrains.com/favicon.ico" className="w-4 h-4" alt="WebStorm" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">WebStorm</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">JetBrains</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#EBECF0] focus:text-[#172B4D] rounded-[3px] mx-1">
                                                                            <a 
                                                                                href={`https://github.com/${project.github_owner}/${project.github_repo}`}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="flex items-center gap-3 py-2 px-2"
                                                                            >
                                                                                <img src="https://github.com/favicon.ico" className="w-4 h-4" alt="GitHub" onError={(e) => { (e.target as HTMLImageElement).style.display='none' }} />
                                                                                <div>
                                                                                    <div className="text-[13px] font-medium text-[#172B4D]">GitHub.com</div>
                                                                                    <div className="text-[11px] text-[#5E6C84]">Open in browser</div>
                                                                                </div>
                                                                            </a>
                                                                        </DropdownMenuItem>
                                                                    </div>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <SubTasksChecklist issueId={bug.id} />

                                <div className="border border-[#DFE1E6] rounded-[3px] overflow-hidden">
                                    {/* Header */}
                                    <div className="px-3 py-2.5 border-b border-[#DFE1E6] bg-[#FAFBFC] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[#5E6C84]" />
                                            <span className="font-semibold text-[13px] text-[#172B4D]">Time Tracking</span>
                                        </div>
                                        {!logWorkOpen && (
                                            <button onClick={() => setLogWorkOpen(true)}
                                                className="text-[11px] bg-[#DEEBFF] hover:bg-[#0052CC] hover:text-white text-[#0052CC] px-2 py-0.5 rounded font-semibold transition-colors">
                                                + Log Work
                                            </button>
                                        )}
                                    </div>

                                    <div className="p-3 space-y-3">
                                        {/* Explanatory note */}
                                        <div className="text-[11px] text-[#5E6C84] bg-[#F4F5F7] rounded px-2.5 py-2 leading-relaxed">
                                            <span className="font-semibold text-[#172B4D]">How it works:</span> Set how long you <em>think</em> this will take (Estimate). As you work, click <em>Log Work</em> to record actual time spent.
                                        </div>

                                        {/* Estimate row */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="text-[11px] font-semibold text-[#5E6C84] mb-1 uppercase tracking-wide">Estimate (how long you think)</div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={bug.original_estimate === '' || bug.original_estimate == null ? '' : Number(bug.original_estimate)}
                                                        onChange={(e) => setBug({ ...bug, original_estimate: e.target.value === '' ? '' : e.target.value })}
                                                        onBlur={(e) => updateField('original_estimate', e.target.value)}
                                                        className={`${selectClasses} px-2 py-1.5 outline-none w-20 text-[13px]`}
                                                        placeholder="0"
                                                        disabled={!canEditAll}
                                                    />
                                                    <span className="text-[12px] text-[#5E6C84]">minutes</span>
                                                    {(bug.original_estimate && Number(bug.original_estimate) > 0) && (
                                                        <span className="text-[12px] font-medium text-[#172B4D]">
                                                            = {Math.floor(Number(bug.original_estimate) / 60) > 0 ? `${Math.floor(Number(bug.original_estimate) / 60)}h ` : ''}{Number(bug.original_estimate) % 60 > 0 ? `${Number(bug.original_estimate) % 60}m` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Visual progress */}
                                        {(() => {
                                            const estimate = Number(bug.original_estimate) || 0
                                            const spent = Number(bug.time_spent) || 0
                                            const remaining = Math.max(0, estimate - spent)
                                            const pct = estimate > 0 ? Math.min(100, Math.round((spent / estimate) * 100)) : 0
                                            const overBudget = spent > estimate && estimate > 0
                                            const fmtMins = (m: number) => { if (!m) return '0m'; const h = Math.floor(m/60); const r = m%60; return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m` }
                                            if (estimate === 0 && spent === 0) return null
                                            return (
                                                <div className="space-y-2 pt-1 border-t border-[#DFE1E6]">
                                                    {/* Three stats */}
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div className="text-center bg-[#F4F5F7] rounded p-2">
                                                            <div className="text-[10px] text-[#5E6C84] uppercase font-bold mb-0.5">Estimated</div>
                                                            <div className="text-[14px] font-bold text-[#172B4D]">{fmtMins(estimate)}</div>
                                                        </div>
                                                        <div className={`text-center rounded p-2 ${spent > 0 ? 'bg-[#DEEBFF]' : 'bg-[#F4F5F7]'}`}>
                                                            <div className="text-[10px] text-[#5E6C84] uppercase font-bold mb-0.5">Logged</div>
                                                            <div className={`text-[14px] font-bold ${spent > 0 ? 'text-[#0052CC]' : 'text-[#B3BAC5]'}`}>{fmtMins(spent)}</div>
                                                        </div>
                                                        <div className={`text-center rounded p-2 ${overBudget ? 'bg-[#FFEBE6]' : remaining > 0 ? 'bg-[#E3FCEF]' : 'bg-[#E3FCEF]'}`}>
                                                            <div className="text-[10px] text-[#5E6C84] uppercase font-bold mb-0.5">Remaining</div>
                                                            <div className={`text-[14px] font-bold ${overBudget ? 'text-[#DE350B]' : 'text-[#00875A]'}`}>
                                                                {overBudget ? `+${fmtMins(spent - estimate)} over` : fmtMins(remaining)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div>
                                                        <div className="flex justify-between text-[10px] text-[#5E6C84] mb-1">
                                                            <span>Progress</span>
                                                            <span className={`font-bold ${overBudget ? 'text-[#DE350B]' : 'text-[#0052CC]'}`}>{pct}%</span>
                                                        </div>
                                                        <div className="h-3 bg-[#DFE1E6] rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-[#FF5630]' : pct > 75 ? 'bg-[#FF991F]' : 'bg-[#36B37E]'}`}
                                                                style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()}

                                        {/* Log Work Panel */}
                                        {logWorkOpen && (
                                            <div className="border border-[#0052CC]/30 rounded bg-[#F4F5F7] p-3 space-y-3">
                                                <div className="text-[12px] font-semibold text-[#172B4D] flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-[#0052CC]" />
                                                    Log Work — how much time did you spend?
                                                </div>
                                                {/* Quick presets */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {['30m', '1h', '2h', '4h', '8h'].map(preset => (
                                                        <button key={preset} onClick={() => setLogWorkTime(preset)}
                                                            className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                                                                logWorkTime === preset
                                                                    ? 'bg-[#0052CC] text-white border-[#0052CC]'
                                                                    : 'bg-white text-[#42526E] border-[#DFE1E6] hover:border-[#0052CC] hover:text-[#0052CC]'
                                                            }`}>{preset}</button>
                                                    ))}
                                                    <input
                                                        type="text"
                                                        placeholder="custom (e.g. 1h 30m)"
                                                        value={logWorkTime}
                                                        onChange={e => setLogWorkTime(e.target.value)}
                                                        className="flex-1 min-w-[120px] border border-[#DFE1E6] rounded px-2 py-1 text-[11px] bg-white outline-none focus:border-[#0052CC]"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => { setLogWorkOpen(false); setLogWorkTime('') }}
                                                        className="text-[12px] text-[#5E6C84] hover:text-[#172B4D] px-2 py-1">Cancel</button>
                                                    <button onClick={handleLogWork}
                                                        className="text-[12px] bg-[#0052CC] hover:bg-[#0047B3] text-white px-3 py-1.5 rounded font-semibold transition-colors">
                                                        Save Work Log
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>

            {connectGithubOpen && project?.github_owner && project?.github_repo && (
                <ConnectGithubModal
                    projectId={projectId}
                    githubOwner={project.github_owner}
                    githubRepo={project.github_repo}
                    onClose={() => setConnectGithubOpen(false)}
                    onSuccess={() => {
                        setConnectGithubOpen(false)
                        // Trigger a re-render to pick up new token
                        setProject({...project}) 
                    }}
                />
            )}

            {createBranchOpen && project?.github_owner && project?.github_repo && (
                <CreateBranchModal
                    projectId={projectId}
                    issueId={bugId!}
                    issueDisplayId={bug?.bug_display_id || ''}
                    issueTitle={bug?.title || ''}
                    isTask={false}
                    githubToken={session?.provider_token || localStorage.getItem(`github_pat_${projectId}`) || ''}
                    githubOwner={project.github_owner}
                    githubRepo={project.github_repo}
                    onClose={() => setCreateBranchOpen(false)}
                    onSuccess={loadData}
                />
            )}

            {createCommitOpen && (
                <CreateCommitModal
                    issueDisplayId={bug?.bug_display_id || ''}
                    onClose={() => setCreateCommitOpen(false)}
                />
            )}

            {logWorkOpen && (
                <LogWorkModal
                    isOpen={logWorkOpen}
                    onClose={() => setLogWorkOpen(false)}
                    ticketId={bug.id}
                    ticketType="bug"
                    ticketDisplayId={bug.bug_display_id}
                    currentOriginalEstimate={bug.original_estimate || 0}
                    currentTimeSpent={bug.time_spent || 0}
                    onWorkLogged={loadData}
                />
            )}
        </Dialog>
    )
}
