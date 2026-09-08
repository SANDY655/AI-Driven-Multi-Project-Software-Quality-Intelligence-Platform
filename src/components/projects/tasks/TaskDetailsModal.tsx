import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, CheckSquare, MessageSquare, Plus, Trash2, ArrowUp, ArrowDown, Minus, UserPlus, Loader2, Link2, GitBranch, GitCommit, Copy, ExternalLink, Clock, Sparkles } from 'lucide-react'

interface TaskDetailsModalProps {
    taskId: string | null
    projectId: string
    userRole?: string
    onClose: () => void
    onUpdate: () => void
}

const PRIORITY_LABELS: Record<string, string> = {
    urgent: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low'
}

const STATUS_LABELS: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done'
}

export function TaskDetailsModal({ taskId, projectId, userRole: initialUserRole, onClose, onUpdate }: TaskDetailsModalProps) {
    const { user } = useAuth()
    const [task, setTask] = useState<any>(null)
    const [comments, setComments] = useState<any[]>([])
    const [activity, setActivity] = useState<any[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(true)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [commentError, setCommentError] = useState<string | null>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(initialUserRole)
    const [subTasks, setSubTasks] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    const [isBreakingDown, setIsBreakingDown] = useState(false)
    const [logWorkOpen, setLogWorkOpen] = useState(false)
    const [logWorkTime, setLogWorkTime] = useState('')
    
    // Development tracking
    const [branches, setBranches] = useState<any[]>([])
    const [commits, setCommits] = useState<any[]>([])
    const [linkCommitOpen, setLinkCommitOpen] = useState(false)
    const [commitUrl, setCommitUrl] = useState('')
    const [copiedBranch, setCopiedBranch] = useState(false)

    const canEditAll = ['admin', 'pm', 'tester', 'developer'].includes(currentUserRole || '')
    const canDelete = ['admin', 'pm'].includes(currentUserRole || '')
    const canPostComment = true

    const formatValue = (action: string, value: string | null) => {
        if (!value || value === 'null' || value === 'None') return 'None'
        if (action.includes('status')) return STATUS_LABELS[value] || value
        if (action.includes('priority')) return PRIORITY_LABELS[value] || value
        if (action.includes('assigned')) {
            const member = members.find(m => m.id === value)
            return member?.display_name || 'User'
        }
        return value
    }

    useEffect(() => {
        if (!taskId) return
        loadData()
    }, [taskId])

    async function loadData() {
        setLoading(true)

        const { data: taskData, error: taskError } = await supabase
            .from('tasks')
            .select(`
                *,
                creator:profiles!tasks_created_by_fkey (display_name, avatar_url),
                assignee:profiles!tasks_assigned_to_fkey (display_name, avatar_url)
            `)
            .eq('id', taskId)
            .single()

        if (taskError) console.error("Error loading task:", taskError)
        setTask(taskData)

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
            .from('task_comments')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('task_id', taskId)
            .order('created_at', { ascending: true })

        setComments(commentsData || [])

        const { data: activityData } = await supabase
            .from('task_activity_log')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(20)

        setActivity(activityData || [])

        const { data: subTasksData } = await supabase
            .from('tasks')
            .select('*')
            .eq('parent_id', taskId)
            .order('created_at', { ascending: true })

        setSubTasks(subTasksData || [])

        const { data: epicsData } = await supabase
            .from('epics')
            .select('id, name')
            .eq('project_id', projectId)
        
        setEpics(epicsData || [])

        // Load development links
        const { data: branchesData } = await supabase
            .from('branch_task_links')
            .select('branches(*)')
            .eq('task_id', taskId)
        
        if (branchesData) {
            setBranches(branchesData.map((d: any) => d.branches).filter(Boolean))
        }

        const { data: commitsData } = await supabase
            .from('commit_task_links')
            .select('commits(*)')
            .eq('task_id', taskId)
        
        if (commitsData) {
            setCommits(commitsData.map((d: any) => d.commits).filter(Boolean))
        }

        setLoading(false)
    }

    // SLA Calculation
    const getSLADetails = () => {
        if (!task) return null
        let slaHours = 0
        switch (task.priority) {
            case 'urgent': slaHours = 24; break;
            case 'high': slaHours = 48; break;
            case 'medium': slaHours = 24 * 7; break;
            case 'low': slaHours = 24 * 14; break;
            default: slaHours = 48;
        }

        const createdTime = new Date(task.created_at).getTime()
        const deadlineTime = createdTime + (slaHours * 60 * 60 * 1000)
        
        if (task.resolved_at) {
            const resolvedTime = new Date(task.resolved_at).getTime()
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
        if (!task || !taskId || !logWorkTime) return
        
        // simple parsing of "2h 30m" to minutes
        const timeStr = logWorkTime.toLowerCase()
        let minutes = 0
        const hoursMatch = timeStr.match(/(\d+)\s*h/)
        const minsMatch = timeStr.match(/(\d+)\s*m/)
        
        if (hoursMatch) minutes += parseInt(hoursMatch[1]) * 60
        if (minsMatch) minutes += parseInt(minsMatch[1])
        
        // If they just typed a number, assume minutes
        if (!hoursMatch && !minsMatch && !isNaN(parseInt(timeStr))) {
            minutes += parseInt(timeStr)
        }

        if (minutes > 0) {
            const newTotal = (task.time_spent || 0) + minutes
            await updateField('time_spent', newTotal.toString())
            setLogWorkOpen(false)
            setLogWorkTime('')
        }
    }

    async function handleCreateBranch() {
        if (!task) return
        const safeTitle = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const branchName = `feature/${task.task_display_id}-${safeTitle}`
        const gitCommand = `git checkout -b ${branchName}`
        
        navigator.clipboard.writeText(gitCommand)
        setCopiedBranch(true)
        setTimeout(() => setCopiedBranch(false), 2000)

        // Save to DB
        const { data: branchData } = await supabase
            .from('branches')
            .insert({ project_id: projectId, name: branchName })
            .select()
            .single()

        if (branchData) {
            await supabase.from('branch_task_links').insert({ branch_id: branchData.id, task_id: taskId })
            setBranches([...branches, branchData])
        }
    }

    async function handleLinkCommit() {
        if (!commitUrl || !taskId) return
        // Mock linking a commit (in real app, fetch SHA from GitHub API)
        const sha = commitUrl.substring(commitUrl.length - 7) || 'unknown'
        
        const { data: commitData } = await supabase
            .from('commits')
            .insert({ project_id: projectId, sha, message: `Linked commit ${sha}`, url: commitUrl })
            .select()
            .single()

        if (commitData) {
            await supabase.from('commit_task_links').insert({ commit_id: commitData.id, task_id: taskId })
            setCommits([...commits, commitData])
        }
        setLinkCommitOpen(false)
        setCommitUrl('')
    }

    async function handleBreakDownWithAI() {
        if (!taskId || !task) return
        setIsBreakingDown(true)
        try {
            // Mock AI behavior for breaking down a task
            const newTasks = [
                {
                    project_id: projectId,
                    parent_id: taskId,
                    title: `[Sub-task 1] - Initial setup for ${task.title.substring(0, 20)}...`,
                    description: 'Generated by AI',
                    priority: task.priority,
                    status: 'todo',
                    task_number: Math.floor(Math.random() * 1000) + 1000,
                    task_display_id: `SUB-${Math.floor(Math.random() * 1000)}`
                },
                {
                    project_id: projectId,
                    parent_id: taskId,
                    title: `[Sub-task 2] - Implementation for ${task.title.substring(0, 20)}...`,
                    description: 'Generated by AI',
                    priority: task.priority,
                    status: 'todo',
                    task_number: Math.floor(Math.random() * 1000) + 1000,
                    task_display_id: `SUB-${Math.floor(Math.random() * 1000)}`
                }
            ]
            
            await supabase.from('tasks').insert(newTasks)
            await loadData()
            onUpdate()
        } finally {
            setIsBreakingDown(false)
        }
    }

    async function handleAddComment() {
        if (!newComment.trim() || !user || !taskId) return
        setSubmittingComment(true)
        setCommentError(null)

        const { error } = await supabase
            .from('task_comments')
            .insert({
                task_id: taskId,
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
        if (!task || !taskId || task[field] === value) return

        const oldValue = task[field]

        // Check for resolution
        const isResolving = (field === 'status' && (value === 'done' || value === 'resolved'))
        const isUnresolving = (field === 'status' && (value !== 'done' && value !== 'resolved') && task.status === 'done')
        
        let extraUpdate = {}
        if (isResolving && !task.resolved_at) {
            extraUpdate = { resolved_at: new Date().toISOString() }
        } else if (isUnresolving) {
            extraUpdate = { resolved_at: null }
        }

        const { error } = await supabase
            .from('tasks')
            .update({ [field]: field === 'story_points' || field === 'original_estimate' || field === 'time_spent' ? parseInt(value as string) || 0 : value, ...extraUpdate })
            .eq('id', taskId)

        if (!error) {
            await supabase
                .from('task_activity_log')
                .insert({
                    task_id: taskId,
                    user_id: user?.id,
                    action: `${field}_changed`,
                    old_value: oldValue ? oldValue.toString() : 'None',
                    new_value: value ? value.toString() : 'None'
                })

            setTask({ ...task, [field]: field === 'story_points' || field === 'original_estimate' || field === 'time_spent' ? parseInt(value as string) || 0 : value })
            onUpdate()
            loadData()
        }
    }

    async function handleDeleteTask() {
        if (!taskId || !canDelete) return
        if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) return

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId)

        if (!error) {
            onUpdate()
            onClose()
        } else {
            alert('Failed to delete task: ' + error.message)
        }
    }

    if (!taskId) return null

    const selectClasses = "w-full bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] border-transparent transition-colors rounded-[3px] focus:ring-[#4C9AFF]"

    return (
        <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-[1040px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px]">
                {loading || !task ? (
                    <div className="flex-1 flex items-center justify-center bg-[#FAFBFC]">
                        <Loader2 className="h-8 w-8 animate-spin text-[#0052CC]" />
                    </div>
                ) : (
                    <>
                        <div className="px-6 py-4 flex justify-between items-start flex-shrink-0 border-b border-[#DFE1E6]">
                            <div className="flex flex-col gap-1">
                                <div className="text-[12px] font-medium text-[#5E6C84]">
                                    {task.task_display_id}
                                </div>
                                <DialogTitle className="text-2xl font-medium text-[#172B4D]">
                                    {task.title}
                                </DialogTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                {canDelete && (
                                    <button
                                        onClick={handleDeleteTask}
                                        className="p-2 text-[#5E6C84] hover:text-[#DE350B] hover:bg-[#FFEBE6] rounded-[3px] transition-colors"
                                        title="Delete Task"
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

                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
                            <div className="w-[65%] flex flex-col h-full overflow-y-auto border-r border-[#DFE1E6] p-6 space-y-8 no-scrollbar bg-white">
                                <section>
                                    <h3 className="text-[14px] font-semibold text-[#172B4D] mb-4">
                                        Description
                                    </h3>
                                    <div className="text-[#172B4D] whitespace-pre-wrap text-sm leading-relaxed p-2 -mx-2 hover:bg-[#FAFBFC] rounded transition-colors cursor-text">
                                        {task.description || 'No description provided.'}
                                    </div>
                                </section>

                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[14px] font-semibold text-[#172B4D]">
                                            Sub-tasks
                                        </h3>
                                        <button
                                            onClick={handleBreakDownWithAI}
                                            disabled={isBreakingDown || !canEditAll}
                                            className="text-sm bg-[#EAE6FF] hover:bg-[#403294] hover:text-white text-[#403294] px-3 py-1.5 rounded-[3px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                        >
                                            {isBreakingDown ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            Break down with AI
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {subTasks.map(st => (
                                            <div key={st.id} className="flex items-center justify-between p-2.5 border border-[#DFE1E6] rounded-[3px] bg-white hover:bg-[#FAFBFC] transition-colors cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <GitBranch className="w-4 h-4 text-[#0052CC]" />
                                                    <span className="text-xs text-[#5E6C84] w-16">{st.task_display_id}</span>
                                                    <span className="text-[13px] text-[#172B4D]">{st.title}</span>
                                                </div>
                                                <div>
                                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-[#DFE1E6] text-[#42526E]">
                                                        {st.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {subTasks.length === 0 && (
                                            <div className="text-[13px] text-[#5E6C84] border border-[#DFE1E6] border-dashed rounded-[3px] p-4 text-center">
                                                No sub-tasks yet. Click "Break down with AI" to auto-generate sub-tasks.
                                            </div>
                                        )}
                                    </div>
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
                                        value={task.status}
                                        onValueChange={(val) => updateField('status', val)}
                                        disabled={!canEditAll}
                                    >
                                        <SelectTrigger className="w-fit bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] font-medium border-none h-8 text-[12px] uppercase">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todo">TO DO</SelectItem>
                                            <SelectItem value="in_progress">IN PROGRESS</SelectItem>
                                            <SelectItem value="in_review">IN REVIEW</SelectItem>
                                            <SelectItem value="done">DONE</SelectItem>
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
                                                    value={task.assigned_to || 'unassigned'}
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
                                                    value={task.priority}
                                                    onValueChange={(val) => updateField('priority', val)}
                                                    disabled={!canEditAll}
                                                >
                                                    <SelectTrigger className={selectClasses}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="urgent"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#DE350B]" /> Highest</div></SelectItem>
                                                        <SelectItem value="high"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#FF5630]" /> High</div></SelectItem>
                                                        <SelectItem value="medium"><div className="flex items-center gap-2"><Minus className="w-4 h-4 text-[#FFAB00]" /> Medium</div></SelectItem>
                                                        <SelectItem value="low"><div className="flex items-center gap-2"><ArrowDown className="w-4 h-4 text-[#0065FF]" /> Low</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Story Points</label>
                                            <div className="w-2/3">
                                                <input 
                                                    type="number" 
                                                    value={task.story_points || ''} 
                                                    onChange={(e) => setTask({ ...task, story_points: e.target.value })}
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
                                                    value={task.epic_id || 'unassigned'}
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
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3 flex items-center gap-1">SLA <Clock className="w-3 h-3" /></label>
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
                                            <button 
                                                onClick={handleCreateBranch}
                                                className="text-sm bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-3 py-1.5 rounded-[3px] font-medium transition-colors border border-[#DFE1E6] flex items-center justify-center gap-2"
                                            >
                                                {copiedBranch ? <CheckSquare className="w-4 h-4 text-[#006644]" /> : <GitBranch className="w-4 h-4 text-[#5E6C84]" />}
                                                {copiedBranch ? 'Copied Command!' : 'Create branch'}
                                            </button>
                                            
                                            {linkCommitOpen ? (
                                                <div className="space-y-2 border border-[#DFE1E6] p-2 rounded-[3px] bg-[#FAFBFC]">
                                                    <input 
                                                        type="text" 
                                                        placeholder="GitHub commit URL"
                                                        value={commitUrl}
                                                        onChange={(e) => setCommitUrl(e.target.value)}
                                                        className={`${selectClasses} px-3 py-1.5 outline-none bg-white`}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setLinkCommitOpen(false)} className="text-[12px] text-[#5E6C84] hover:underline">Cancel</button>
                                                        <button onClick={handleLinkCommit} className="text-[12px] bg-[#0052CC] text-white px-2 py-0.5 rounded-[3px] hover:bg-[#0047B3]">Link</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setLinkCommitOpen(true)}
                                                    className="w-full text-center text-[13px] text-[#0052CC] hover:bg-[#DEEBFF] py-1 rounded-[3px] transition-colors"
                                                >
                                                    Link commit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-[#DFE1E6] rounded-[3px]">
                                    <div className="p-3 border-b border-[#DFE1E6] font-medium text-[14px] text-[#172B4D]">
                                        Time Tracking
                                    </div>
                                    <div className="p-3 space-y-4">
                                        <div className="flex items-center">
                                            <label className="text-[12px] font-semibold text-[#5E6C84] w-1/3">Estimate</label>
                                            <div className="w-2/3 flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    value={task.original_estimate || ''} 
                                                    onChange={(e) => setTask({ ...task, original_estimate: e.target.value })}
                                                    onBlur={(e) => updateField('original_estimate', e.target.value)}
                                                    className={`${selectClasses} px-3 py-1.5 outline-none w-20`}
                                                    placeholder="0"
                                                    disabled={!canEditAll}
                                                />
                                                <span className="text-[12px] text-[#5E6C84]">minutes</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[12px] text-[#5E6C84]">
                                                <span>Logged: {task.time_spent || 0}m</span>
                                                <span>Remaining: {Math.max(0, (task.original_estimate || 0) - (task.time_spent || 0))}m</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[#DFE1E6] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[#0052CC]" 
                                                    style={{ width: `${Math.min(100, (task.time_spent || 0) / (task.original_estimate || 1) * 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        {logWorkOpen ? (
                                            <div className="space-y-2 border border-[#DFE1E6] p-2 rounded-[3px] bg-[#FAFBFC]">
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. 2h 30m"
                                                    value={logWorkTime}
                                                    onChange={(e) => setLogWorkTime(e.target.value)}
                                                    className={`${selectClasses} px-3 py-1.5 outline-none bg-white`}
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setLogWorkOpen(false)} className="text-[12px] text-[#5E6C84] hover:underline">Cancel</button>
                                                    <button onClick={handleLogWork} className="text-[12px] bg-[#0052CC] text-white px-2 py-0.5 rounded-[3px] hover:bg-[#0047B3]">Save</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => setLogWorkOpen(true)}
                                                className="w-full text-center text-[13px] text-[#0052CC] hover:bg-[#DEEBFF] py-1 rounded-[3px] transition-colors"
                                            >
                                                Log Work
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
