import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, UserPlus, Trash2, Clock, MessageSquare, Activity, X } from 'lucide-react'

interface TaskDetailsModalProps {
    taskId: string | null
    projectId: string
    userRole?: string
    onClose: () => void
    onUpdate: () => void
}

const PRIORITY_LABELS: Record<string, string> = {
    urgent: 'Urgent',
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

    // Compute permissions
    const canEditAll = ['admin', 'pm', 'tester', 'developer'].includes(currentUserRole || '')
    const canDelete = ['admin', 'pm'].includes(currentUserRole || '')
    const canPostComment = true // All project members can comment usually

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

        // Fetch project members for assignment
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

        // Fetch comments
        const { data: commentsData } = await supabase
            .from('task_comments')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('task_id', taskId)
            .order('created_at', { ascending: true })

        setComments(commentsData || [])

        // Fetch activity logs
        const { data: activityData } = await supabase
            .from('task_activity_log')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(20)

        setActivity(activityData || [])

        setLoading(false)
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
            // Optimistic refresh
            loadData()
        }
        setSubmittingComment(false)
    }

    async function updateField(field: string, value: string | null) {
        if (!task || !taskId || task[field] === value) return

        const oldValue = task[field]

        const { error } = await supabase
            .from('tasks')
            .update({ [field]: value })
            .eq('id', taskId)

        if (!error) {
            // Log activity manually if not handled by triggers (since there's no DB trigger for activity yet)
            await supabase
                .from('task_activity_log')
                .insert({
                    task_id: taskId,
                    user_id: user?.id,
                    action: `${field}_changed`,
                    old_value: oldValue || 'None',
                    new_value: value || 'None'
                })

            setTask({ ...task, [field]: value })
            onUpdate()
            loadData() // refresh logs
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

    return (
        <Dialog open={!!taskId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white border-zinc-200 shadow-xl">
                {loading || !task ? (
                    <div className="flex-1 flex items-center justify-center bg-zinc-50/50">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-200 bg-zinc-50 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-mono text-zinc-600 bg-white border border-zinc-200 shadow-sm px-2 py-1 rounded">
                                        {task.task_display_id}
                                    </span>
                                </div>
                                <DialogTitle className="text-2xl font-semibold text-zinc-900">
                                    {task.title}
                                </DialogTitle>
                            </div>
                            <div className="flex items-center gap-1">
                                {canDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleDeleteTask}
                                        className="h-9 w-9 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                        title="Delete Task"
                                    >
                                        <Trash2 className="h-[18px] w-[18px]" />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="h-9 w-9 text-zinc-400 hover:text-zinc-900 transition-colors"
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Body layout */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
                            {/* Main Content (Left) */}
                            <div className="w-[60%] flex flex-col h-full overflow-y-auto border-r border-zinc-200 p-6 space-y-8 no-scrollbar bg-white">
                                {/* Description */}
                                <section>
                                    <h3 className="text-xs font-semibold text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                                        Description
                                    </h3>
                                    <div className="text-zinc-700 whitespace-pre-wrap text-sm leading-relaxed bg-zinc-50 p-5 rounded-2xl border border-zinc-200 shadow-sm">
                                        {task.description || 'No description provided.'}
                                    </div>
                                </section>

                                {/* Comments Section */}
                                <section className="flex-1 flex flex-col">
                                    <h3 className="text-sm font-medium text-zinc-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Discussion
                                    </h3>

                                    <div className="flex-1 overflow-y-auto mb-6 pr-2 no-scrollbar min-h-[200px]">
                                        <div className="space-y-4">
                                            {comments.map(c => (
                                                <div key={c.id} className="flex gap-4 group">
                                                    <div className="flex-shrink-0 mt-1">
                                                        {c.profiles?.avatar_url ? (
                                                            <img src={c.profiles.avatar_url} className="h-9 w-9 rounded-full ring-2 ring-white shadow-sm" alt="avatar" />
                                                        ) : (
                                                            <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200">
                                                                {c.profiles?.display_name?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 bg-white rounded-2xl p-4 border border-zinc-200 shadow-sm group-hover:border-zinc-300 transition-all duration-200">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-sm font-semibold text-zinc-900">{c.profiles?.display_name}</span>
                                                            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-medium">
                                                                <Clock className="h-3 w-3" />
                                                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">{c.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {comments.length === 0 && (
                                                <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                                                    <MessageSquare className="h-8 w-8 text-zinc-400 mb-3 opacity-50" />
                                                    <p className="text-sm text-zinc-500 font-medium">No comments yet</p>
                                                    <p className="text-xs text-zinc-400 mt-1">Be the first to start the discussion</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-zinc-200 bg-white">
                                        <div className="relative">
                                            <Textarea
                                                placeholder="Write a comment..."
                                                value={newComment}
                                                onChange={(e) => {
                                                    setNewComment(e.target.value)
                                                    if (commentError) setCommentError(null)
                                                }}
                                                className="min-h-[100px] mb-3 bg-white border-zinc-200 text-zinc-900 focus:border-blue-500/50 focus:ring-blue-500/10 transition-shadow resize-none rounded-xl"
                                            />
                                            {commentError && (
                                                <div className="absolute top-2 right-2 text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200">
                                                    Failed to post: {commentError}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-end items-center gap-4">
                                            {commentError && <span className="text-xs text-red-600 font-medium">Try again or check your permissions</span>}
                                            <Button
                                                disabled={submittingComment || !newComment.trim()}
                                                onClick={handleAddComment}
                                                className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-sm px-6"
                                            >
                                                {submittingComment ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <MessageSquare className="mr-2 h-4 w-4" />
                                                )}
                                                {canPostComment ? 'Comment' : 'Read Only'}
                                            </Button>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* Sidebar (Right) */}
                            <div className="w-[40%] bg-zinc-50 p-6 flex flex-col h-full overflow-y-auto no-scrollbar space-y-6">
                                {/* Attributes */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Status</label>
                                        <Select
                                            value={task.status}
                                            onValueChange={(val) => updateField('status', val)}
                                            disabled={!canEditAll}
                                        >
                                            <SelectTrigger className="w-full bg-white text-zinc-900 border-zinc-200 disabled:opacity-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="todo">To Do</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="in_review">In Review</SelectItem>
                                                <SelectItem value="done">Done</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Assignee</label>
                                        <Select
                                            value={task.assigned_to || 'unassigned'}
                                            onValueChange={(val) => updateField('assigned_to', val === 'unassigned' ? null : val)}
                                            disabled={!canEditAll}
                                        >
                                            <SelectTrigger className="w-full bg-white border-zinc-200 text-zinc-900 disabled:opacity-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned" className="text-zinc-400 italic">Unassigned</SelectItem>
                                                {members.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        <div className="flex items-center gap-2">
                                                            {m.avatar_url ? (
                                                                <img src={m.avatar_url} className="h-4 w-4 rounded-full" />
                                                            ) : (
                                                                <UserPlus className="h-4 w-4 text-zinc-400" />
                                                            )}
                                                            {m.display_name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Priority</label>
                                        <Select
                                            value={task.priority}
                                            onValueChange={(val) => updateField('priority', val)}
                                            disabled={!canEditAll}
                                        >
                                            <SelectTrigger className="w-full bg-white text-zinc-900 border-zinc-200 disabled:opacity-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="urgent">Urgent</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="low">Low</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pt-4 border-t border-zinc-200">
                                        <div className="text-xs text-zinc-500 mb-1">Created by</div>
                                        <div className="flex items-center gap-2 text-sm text-zinc-700">
                                            {task.creator?.avatar_url && <img src={task.creator.avatar_url} className="h-5 w-5 rounded-full" />}
                                            {task.creator?.display_name || 'Unknown'}
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Log (Mini) */}
                                <div className="flex-1 min-h-[300px] border-t border-zinc-200 pt-6">
                                    <h3 className="text-xs font-semibold text-zinc-500 mb-5 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="h-3.5 w-3.5 text-blue-500" /> Recent Activity
                                    </h3>
                                    <div className="space-y-6">
                                        {activity.map((act, i) => {
                                            const isStatus = act.action.includes('status')
                                            const isPriority = act.action.includes('priority')
                                            const isAssignee = act.action.includes('assigned')

                                            return (
                                                <div key={act.id} className="relative pl-6 group">
                                                    {/* Timeline connector */}
                                                    {i !== activity.length - 1 && (
                                                        <div className="absolute left-[7px] top-4 bottom-[-24px] w-[1px] bg-zinc-200 group-hover:bg-zinc-300 transition-colors" />
                                                    )}

                                                    {/* Icon dot */}
                                                    <div className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-zinc-50 flex items-center justify-center transition-all duration-300 ${isStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                                        isPriority ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                                            isAssignee ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' :
                                                                'bg-zinc-400'
                                                        }`}>
                                                        <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                                                    </div>

                                                    <div className="text-xs text-zinc-500">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <span className="font-bold text-zinc-900">{act.profiles?.display_name || 'System'}</span>
                                                            <span className="text-zinc-500">updated</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${isStatus ? 'bg-emerald-50 text-emerald-600' :
                                                                isPriority ? 'bg-amber-50 text-amber-600' :
                                                                    isAssignee ? 'bg-blue-50 text-blue-600' :
                                                                        'bg-zinc-100 text-zinc-600'
                                                                }`}>
                                                                {act.action.replace('_changed', '').replace('_', ' ')}
                                                            </span>
                                                        </div>

                                                        <div className="bg-white border border-zinc-200 rounded-lg p-2 mt-1.5 shadow-sm group-hover:border-zinc-300 transition-colors">
                                                            <span className="text-zinc-500 italic">{formatValue(act.action, act.old_value)}</span>
                                                            <span className="mx-2 text-zinc-400 font-mono">&rarr;</span>
                                                            <span className="text-zinc-900 font-medium">{formatValue(act.action, act.new_value)}</span>
                                                        </div>

                                                        <div className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1 font-medium">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {activity.length === 0 && (
                                            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-dashed border-zinc-200 shadow-sm">
                                                <Activity className="h-6 w-6 text-zinc-300 mb-2 opacity-50" />
                                                <p className="text-[10px] text-zinc-500 font-medium">No activity recorded</p>
                                            </div>
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
