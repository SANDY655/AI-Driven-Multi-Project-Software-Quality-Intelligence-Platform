import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { User as UserIcon, Send, Loader2 } from 'lucide-react'

interface BugCommentsProps {
    bugId: string
}

export function BugComments({ bugId }: BugCommentsProps) {
    const { user } = useAuth()
    const [comments, setComments] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [newComment, setNewComment] = useState('')

    const fetchComments = async () => {
        const { data } = await supabase
            .from('bug_comments')
            .select(`
                id, 
                content, 
                created_at,
                profiles:user_id (display_name, avatar_url)
            `)
            .eq('bug_id', bugId)
            .order('created_at', { ascending: true })
        
        if (data) setComments(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchComments()
    }, [bugId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newComment.trim() || !user) return

        setSubmitting(true)
        const { error } = await supabase
            .from('bug_comments')
            .insert({
                bug_id: bugId,
                user_id: user.id,
                content: newComment.trim()
            })
        
        if (!error) {
            setNewComment('')
            
            // Also add to activity log
            await supabase.from('activity_log').insert({
                bug_id: bugId,
                user_id: user.id,
                action: 'commented'
            })
            
            fetchComments()
        }
        setSubmitting(false)
    }

    if (loading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-16 bg-zinc-100 rounded-xl"></div>
            <div className="h-16 bg-zinc-100 rounded-xl"></div>
        </div>
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                {comments.length === 0 ? (
                    <div className="text-center text-sm text-zinc-500 py-6 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                        No comments yet. Be the first to start the discussion!
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-4">
                            <div className="flex-shrink-0 mt-1">
                                {comment.profiles?.avatar_url ? (
                                    <img src={comment.profiles.avatar_url} className="w-8 h-8 rounded-full shadow-sm" alt="avatar" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center">
                                        <UserIcon className="w-4 h-4 text-zinc-400" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 bg-white border border-zinc-100 shadow-sm rounded-2xl rounded-tl-sm p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-zinc-900 text-sm">
                                        {comment.profiles?.display_name || 'Unknown User'}
                                    </span>
                                    <span className="text-xs text-zinc-400 font-medium">
                                        {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                                <p className="text-zinc-600 text-sm whitespace-pre-wrap leading-relaxed">
                                    {comment.content}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex gap-4 items-start">
                <div className="flex-1">
                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="resize-none min-h-[100px] rounded-xl border-zinc-200 focus-visible:ring-indigo-500 text-sm"
                        disabled={submitting}
                    />
                </div>
                <Button 
                    type="submit" 
                    disabled={!newComment.trim() || submitting}
                    className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 font-semibold shadow-sm flex gap-2"
                >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Post
                </Button>
            </form>
        </div>
    )
}
