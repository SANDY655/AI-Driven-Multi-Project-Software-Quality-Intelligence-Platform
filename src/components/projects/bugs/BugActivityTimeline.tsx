import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, User as UserIcon, GitCommit, MessageSquare, UserPlus, CheckCircle, Clock } from 'lucide-react'

interface BugActivityTimelineProps {
    bugId: string
}

export function BugActivityTimeline({ bugId }: BugActivityTimelineProps) {
    const [activities, setActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchActivity = async () => {
            const { data } = await supabase
                .from('activity_log')
                .select(`
                    id, 
                    action, 
                    old_value, 
                    new_value, 
                    created_at,
                    profiles:user_id (display_name, avatar_url)
                `)
                .eq('bug_id', bugId)
                .order('created_at', { ascending: false })
            
            if (data) setActivities(data)
            setLoading(false)
        }
        
        fetchActivity()
    }, [bugId])

    if (loading) {
        return <div className="animate-pulse space-y-4">
            <div className="h-12 bg-zinc-100/70 rounded-2xl"></div>
            <div className="h-12 bg-zinc-100/70 rounded-2xl"></div>
        </div>
    }

    if (activities.length === 0) {
        return <div className="text-center text-xs text-zinc-400 py-6 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-100 font-sans">No activity recorded yet.</div>
    }

    const formatAction = (action: string) => {
        switch(action) {
            case 'status_changed': return 'changed status'
            case 'assigned': return 'assigned the bug'
            case 'commented': return 'added a comment'
            case 'commit_linked': return 'linked a commit'
            default: return action.replace('_', ' ')
        }
    }

    const getActionIcon = (action: string) => {
        switch(action) {
            case 'status_changed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            case 'assigned': return <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
            case 'commented': return <MessageSquare className="w-3.5 h-3.5 text-violet-600" />
            case 'commit_linked': return <GitCommit className="w-3.5 h-3.5 text-amber-600" />
            default: return <Activity className="w-3.5 h-3.5 text-zinc-600" />
        }
    }

    const getIconBg = (action: string) => {
        switch(action) {
            case 'status_changed': return 'bg-emerald-50 border-emerald-100'
            case 'assigned': return 'bg-indigo-50 border-indigo-100'
            case 'commented': return 'bg-violet-50 border-violet-100'
            case 'commit_linked': return 'bg-amber-50 border-amber-100'
            default: return 'bg-zinc-50 border-zinc-200'
        }
    }

    return (
        <div className="relative pl-6 space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-100 font-sans">
            {activities.map((act) => {
                const displayName = act.profiles?.display_name || (act.action === 'commit_linked' ? 'GitHub Webhook' : 'System')
                const avatarUrl = act.profiles?.avatar_url
                
                return (
                    <div key={act.id} className="relative flex gap-4 items-start group">
                        {/* Icon Indicator */}
                        <div className={`absolute -left-[20px] top-1.5 flex items-center justify-center w-7 h-7 rounded-full border border-white shadow-sm transition-all duration-300 ${getIconBg(act.action)} z-10`}>
                            {getActionIcon(act.action)}
                        </div>

                        {/* Content Card */}
                        <div className="flex-1 bg-white border border-zinc-100 rounded-2xl p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:border-zinc-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all">
                            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                                <div className="font-semibold text-zinc-800 text-xs flex items-center gap-1.5">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} className="w-4 h-4 rounded-full border border-zinc-100" alt="avatar" />
                                    ) : (
                                        <div className="w-4 h-4 rounded-full bg-zinc-50 flex items-center justify-center border border-zinc-200">
                                            <UserIcon className="w-2.5 h-2.5 text-zinc-400" />
                                        </div>
                                    )}
                                    <span className="truncate max-w-[120px]">{displayName}</span>
                                </div>
                                <time className="text-[10px] font-medium text-zinc-400 whitespace-nowrap flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </time>
                            </div>
                            
                            <div className="text-xs text-zinc-600">
                                <span className="font-medium text-zinc-500">{formatAction(act.action)}</span>
                                {act.old_value && act.new_value && (
                                    <div className="mt-2 flex items-center gap-2 bg-zinc-50 border border-zinc-100 rounded-xl px-2.5 py-1.5 w-fit">
                                        <span className="font-mono text-[10px] text-zinc-400 line-through">{act.old_value}</span>
                                        <span className="text-zinc-400 text-[10px] font-bold">&rarr;</span>
                                        <span className="font-semibold text-zinc-700 text-xs">{act.new_value}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
