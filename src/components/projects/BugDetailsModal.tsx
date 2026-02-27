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
import { Loader2, UserPlus, Clock, MessageSquare, Activity, Trash2 } from 'lucide-react'

interface BugDetailsModalProps {
    bugId: string | null
    projectId: string
    userRole?: string
    onClose: () => void
    onUpdate: () => void
}

const PRIORITY_LABELS: Record<string, string> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low'
}

const STATUS_LABELS: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    in_review: 'In Review',
    resolved: 'Resolved',
    closed: 'Closed'
}

export function BugDetailsModal({ bugId, projectId, userRole: initialUserRole, onClose, onUpdate }: BugDetailsModalProps) {
    const { user } = useAuth()
    const [bug, setBug] = useState<any>(null)
    const [comments, setComments] = useState<any[]>([])
    const [activity, setActivity] = useState<any[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(true)
    const [submittingComment, setSubmittingComment] = useState(false)
    const [commentError, setCommentError] = useState<string | null>(null)
    const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(initialUserRole)

    // Compute permissions
    const canEditAll = ['admin', 'pm', 'tester'].includes(currentUserRole || '')
    const canEditStatus = ['admin', 'pm', 'tester', 'developer'].includes(currentUserRole || '')
    const canPostComment = true // All project members can comment usually
    const canDelete = ['admin', 'pm'].includes(currentUserRole || '')

    const formatValue = (action: string, value: string | null) => {
        if (!value || value === 'null' || value === 'None') return 'None'
        if (action.includes('status')) return STATUS_LABELS[value] || value
        if (action.includes('priority')) return PRIORITY_LABELS[value] || value
        if (action.includes('severity')) return value.charAt(0).toUpperCase() + value.slice(1)
        if (action.includes('assigned')) {
            const member = members.find(m => m.id === value)
            return member?.display_name || 'User'
        }
        return value
    }

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
            .from('bug_comments')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('bug_id', bugId)
            .order('created_at', { ascending: true })

        setComments(commentsData || [])

        // Fetch activity logs
        const { data: activityData } = await supabase
            .from('activity_log')
            .select(`*, profiles(display_name, avatar_url)`)
            .eq('bug_id', bugId)
            .order('created_at', { ascending: false })
            .limit(20)

        setActivity(activityData || [])
        setLoading(false)
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
            // Optimistic refresh
            loadData()
        }
        setSubmittingComment(false)
    }

    async function updateField(field: string, value: string | null) {
        if (!bug || !bugId || bug[field] === value) return

        const oldValue = bug[field]

        const { error } = await supabase
            .from('bugs')
            .update({ [field]: value })
            .eq('id', bugId)

        if (!error) {
            // Log activity manually if not handled by triggers (since there's no DB trigger for activity yet)
            await supabase
                .from('activity_log')
                .insert({
                    bug_id: bugId,
                    user_id: user?.id,
                    action: `${field}_changed`,
                    old_value: oldValue || 'None',
                    new_value: value || 'None'
                })

            setBug({ ...bug, [field]: value })
            onUpdate()
            loadData() // refresh logs
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

    return (
        <Dialog open={!!bugId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-950 border-zinc-800">
                {loading || !bug ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-sm font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                                        {bug.bug_display_id}
                                    </span>
                                </div>
                                <DialogTitle className="text-2xl font-semibold text-white">
                                    {bug.title}
                                </DialogTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                {canDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleDeleteBug}
                                        className="h-9 w-9 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        title="Delete Bug"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Body layout */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Main Content (Left) */}
                            <div className="flex-1 flex flex-col h-full overflow-y-auto border-r border-zinc-800 p-6 space-y-8 no-scrollbar">
                                {/* Description */}
                                <section>
                                    <h3 className="text-xs font-semibold text-zinc-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                        Description
                                    </h3>
                                    <div className="text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800/50 shadow-inner">
                                        {bug.description || 'No description provided.'}
                                    </div>
                                </section>

                                {/* Comments Section */}
                                <section className="flex-1 flex flex-col">
                                    <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Discussion
                                    </h3>

                                    <div className="flex-1 overflow-y-auto mb-6 pr-2 no-scrollbar min-h-[200px]">
                                        <div className="space-y-4">
                                            {comments.map(c => (
                                                <div key={c.id} className="flex gap-4 group">
                                                    <div className="flex-shrink-0 mt-1">
                                                        {c.profiles?.avatar_url ? (
                                                            <img src={c.profiles.avatar_url} className="h-9 w-9 rounded-full ring-2 ring-zinc-800" alt="avatar" />
                                                        ) : (
                                                            <div className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                                                                {c.profiles?.display_name?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/50 group-hover:border-zinc-700/50 transition-all duration-200">
                                                        <div className="flex items-center justify-between mb-1.5">
                                                            <span className="text-sm font-semibold text-zinc-100">{c.profiles?.display_name}</span>
                                                            <span className="text-[11px] text-zinc-500 flex items-center gap-1.5 font-medium">
                                                                <Clock className="h-3 w-3" />
                                                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{c.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {comments.length === 0 && (
                                                <div className="flex flex-col items-center justify-center p-12 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800/60">
                                                    <MessageSquare className="h-8 w-8 text-zinc-700 mb-3 opacity-20" />
                                                    <p className="text-sm text-zinc-500 font-medium">No comments yet</p>
                                                    <p className="text-xs text-zinc-600 mt-1">Be the first to start the discussion</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-zinc-800/50 bg-zinc-950/20 rounded-b-xl">
                                        <div className="relative">
                                            <Textarea
                                                placeholder="Write a comment..."
                                                value={newComment}
                                                onChange={(e) => {
                                                    setNewComment(e.target.value)
                                                    if (commentError) setCommentError(null)
                                                }}
                                                className="min-h-[100px] mb-3 bg-zinc-900/30 border-zinc-800 text-white focus:border-blue-500/50 focus:ring-blue-500/10 transition-shadow resize-none rounded-xl"
                                            />
                                            {commentError && (
                                                <div className="absolute top-2 right-2 text-[10px] text-red-400 bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                                                    Failed to post: {commentError}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex justify-end items-center gap-4">
                                            {commentError && <span className="text-xs text-red-400 font-medium">Try again or check your permissions</span>}
                                            <Button
                                                disabled={submittingComment || !newComment.trim()}
                                                onClick={handleAddComment}
                                                className="bg-blue-600 hover:bg-blue-500 text-white border-none shadow-lg shadow-blue-900/20 px-6"
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
                            <div className="w-full md:w-72 bg-zinc-950 p-6 flex flex-col h-full overflow-y-auto no-scrollbar space-y-6">
                                {/* Attributes */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Status</label>
                                        <Select
                                            value={bug.status}
                                            onValueChange={(val) => updateField('status', val)}
                                            disabled={!canEditStatus}
                                        >
                                            <SelectTrigger className="w-full bg-zinc-900 text-white border-zinc-800 disabled:opacity-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="open">Open</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="in_review">In Review</SelectItem>
                                                <SelectItem value="resolved">Resolved</SelectItem>
                                                <SelectItem value="closed">Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Assignee</label>
                                        <Select
                                            value={bug.assigned_to || 'unassigned'}
                                            onValueChange={(val) => updateField('assigned_to', val === 'unassigned' ? null : val)}
                                            disabled={!canEditAll}
                                        >
                                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-white disabled:opacity-50">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="unassigned" className="text-zinc-500 italic">Unassigned</SelectItem>
                                                {members.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        <div className="flex items-center gap-2">
                                                            {m.avatar_url ? (
                                                                <img src={m.avatar_url} className="h-4 w-4 rounded-full" />
                                                            ) : (
                                                                <UserPlus className="h-4 w-4 text-zinc-500" />
                                                            )}
                                                            {m.display_name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Priority</label>
                                            <Select
                                                value={bug.priority}
                                                onValueChange={(val) => updateField('priority', val)}
                                                disabled={!canEditAll}
                                            >
                                                <SelectTrigger className="w-full bg-zinc-900 text-white border-zinc-800 disabled:opacity-50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="P0">P0 - Critical</SelectItem>
                                                    <SelectItem value="P1">P1 - High</SelectItem>
                                                    <SelectItem value="P2">P2 - Medium</SelectItem>
                                                    <SelectItem value="P3">P3 - Low</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div>
                                            <label className="text-xs text-zinc-500 font-medium mb-1.5 block uppercase tracking-wider">Severity</label>
                                            <Select
                                                value={bug.severity}
                                                onValueChange={(val) => updateField('severity', val)}
                                                disabled={!canEditAll}
                                            >
                                                <SelectTrigger className="w-full bg-zinc-900 text-white border-zinc-800 disabled:opacity-50">
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

                                    <div className="pt-4 border-t border-zinc-800/50">
                                        <div className="text-xs text-zinc-500 mb-1">Reported by</div>
                                        <div className="flex items-center gap-2 text-sm text-zinc-300">
                                            {bug.reporter?.avatar_url && <img src={bug.reporter.avatar_url} className="h-5 w-5 rounded-full" />}
                                            {bug.reporter?.display_name || 'Unknown'}
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Log (Mini) */}
                                <div className="flex-1 min-h-[300px] border-t border-zinc-800/60 pt-6">
                                    <h3 className="text-xs font-semibold text-zinc-400 mb-5 uppercase tracking-widest flex items-center gap-2">
                                        <Activity className="h-3.5 w-3.5 text-blue-400" /> Recent Activity
                                    </h3>
                                    <div className="space-y-6">
                                        {activity.map((act, i) => {
                                            const isStatus = act.action.includes('status')
                                            const isPriority = act.action.includes('priority')
                                            const isSeverity = act.action.includes('severity')
                                            const isAssignee = act.action.includes('assigned')

                                            return (
                                                <div key={act.id} className="relative pl-6 group">
                                                    {/* Timeline connector */}
                                                    {i !== activity.length - 1 && (
                                                        <div className="absolute left-[7px] top-4 bottom-[-24px] w-[1px] bg-zinc-800 group-hover:bg-zinc-700 transition-colors" />
                                                    )}

                                                    {/* Icon dot */}
                                                    <div className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full ring-4 ring-zinc-950 flex items-center justify-center transition-all duration-300 ${isStatus ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                                        isPriority ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                                            isSeverity ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' :
                                                                isAssignee ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' :
                                                                    'bg-zinc-600'
                                                        }`}>
                                                        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                                                    </div>

                                                    <div className="text-xs text-zinc-400">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            <span className="font-bold text-zinc-200">{act.profiles?.display_name || 'System'}</span>
                                                            <span className="text-zinc-500">updated</span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${isStatus ? 'bg-emerald-500/10 text-emerald-400' :
                                                                isPriority ? 'bg-amber-500/10 text-amber-400' :
                                                                    isSeverity ? 'bg-rose-500/10 text-rose-400' :
                                                                        isAssignee ? 'bg-blue-500/10 text-blue-400' :
                                                                            'bg-zinc-800 text-zinc-400'
                                                                }`}>
                                                                {act.action.replace('_changed', '').replace('_', ' ')}
                                                            </span>
                                                        </div>

                                                        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 mt-1.5 group-hover:border-zinc-700/50 transition-colors">
                                                            <span className="text-zinc-500 italic">{formatValue(act.action, act.old_value)}</span>
                                                            <span className="mx-2 text-zinc-700 font-mono">&rarr;</span>
                                                            <span className="text-zinc-200 font-medium">{formatValue(act.action, act.new_value)}</span>
                                                        </div>

                                                        <div className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1 font-medium">
                                                            <Clock className="h-2.5 w-2.5" />
                                                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {activity.length === 0 && (
                                            <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/10 rounded-xl border border-dashed border-zinc-800/40">
                                                <Activity className="h-6 w-6 text-zinc-800 mb-2 opacity-10" />
                                                <p className="text-[10px] text-zinc-600 font-medium">No activity recorded</p>
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
