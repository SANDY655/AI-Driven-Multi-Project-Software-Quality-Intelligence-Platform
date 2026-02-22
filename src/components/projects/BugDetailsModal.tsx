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
import { Loader2, UserPlus, Clock, MessageSquare, Activity } from 'lucide-react'

interface BugDetailsModalProps {
    bugId: string | null
    projectId: string
    onClose: () => void
    onUpdate: () => void
}

export function BugDetailsModal({ bugId, projectId, onClose, onUpdate }: BugDetailsModalProps) {
    const { user } = useAuth()
    const [bug, setBug] = useState<any>(null)
    const [comments, setComments] = useState<any[]>([])
    const [activity, setActivity] = useState<any[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(true)
    const [submittingComment, setSubmittingComment] = useState(false)

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

        const { error } = await supabase
            .from('bug_comments')
            .insert({
                bug_id: bugId,
                user_id: user.id,
                content: newComment
            })

        if (!error) {
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
                        </div>

                        {/* Body layout */}
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Main Content (Left) */}
                            <div className="flex-1 flex flex-col h-full overflow-y-auto border-r border-zinc-800 p-6 space-y-8 no-scrollbar">
                                {/* Description */}
                                <section>
                                    <h3 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Description</h3>
                                    <div className="text-zinc-200 whitespace-pre-wrap text-sm leading-relaxed bg-zinc-900/50 p-4 rounded-lg border border-zinc-800/50">
                                        {bug.description || 'No description provided.'}
                                    </div>
                                </section>

                                {/* Comments Section */}
                                <section className="flex-1 flex flex-col">
                                    <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" /> Discussion
                                    </h3>

                                    <div className="space-y-4 mb-6">
                                        {comments.map(c => (
                                            <div key={c.id} className="flex gap-4 group">
                                                <div className="flex-shrink-0 mt-1">
                                                    {c.profiles?.avatar_url ? (
                                                        <img src={c.profiles.avatar_url} className="h-8 w-8 rounded-full ring-1 ring-zinc-700" alt="avatar" />
                                                    ) : (
                                                        <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                                                            {c.profiles?.display_name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 bg-zinc-900/80 rounded-lg p-3 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-white">{c.profiles?.display_name}</span>
                                                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-zinc-300 whitespace-pre-wrap">{c.content}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {comments.length === 0 && (
                                            <div className="text-center text-zinc-500 p-4 bg-zinc-900/30 rounded-lg border border-dashed border-zinc-800">
                                                No comments yet. Start the conversation!
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto">
                                        <Textarea
                                            placeholder="Add a comment..."
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            className="min-h-[100px] mb-3 bg-zinc-900/50"
                                        />
                                        <div className="flex justify-end">
                                            <Button disabled={submittingComment || !newComment.trim()} onClick={handleAddComment}>
                                                {submittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Comment
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
                                        <Select value={bug.status} onValueChange={(val) => updateField('status', val)}>
                                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
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
                                        <Select value={bug.assigned_to || 'unassigned'} onValueChange={(val) => updateField('assigned_to', val === 'unassigned' ? null : val)}>
                                            <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
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
                                            <Select value={bug.priority} onValueChange={(val) => updateField('priority', val)}>
                                                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
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
                                            <Select value={bug.severity} onValueChange={(val) => updateField('severity', val)}>
                                                <SelectTrigger className="w-full bg-zinc-900 border-zinc-800">
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
                                <div className="flex-1 min-h-[200px] border-t border-zinc-800 pt-6">
                                    <h3 className="text-xs font-medium text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                        <Activity className="h-3.5 w-3.5" /> Recent Activity
                                    </h3>
                                    <div className="space-y-4">
                                        {activity.map(act => (
                                            <div key={act.id} className="relative pl-4 border-l border-zinc-800">
                                                <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-zinc-700 ring-4 ring-zinc-950" />
                                                <div className="text-xs text-zinc-400">
                                                    <span className="font-medium text-zinc-300">{act.profiles?.display_name || 'System'}</span>
                                                    {' '}updated <span className="text-white">{act.action.replace('_changed', '')}</span>
                                                    <br />
                                                    <span className="text-zinc-500 line-clamp-1 mt-0.5">{act.old_value} &rarr; {act.new_value}</span>
                                                    <div className="text-[10px] text-zinc-600 mt-1">{formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}</div>
                                                </div>
                                            </div>
                                        ))}
                                        {activity.length === 0 && (
                                            <div className="text-xs text-zinc-500 italic ml-4">No recent activity</div>
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
