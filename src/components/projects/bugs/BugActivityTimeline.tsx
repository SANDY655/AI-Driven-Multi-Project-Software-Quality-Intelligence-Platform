import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, User as UserIcon } from 'lucide-react'

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
            <div className="h-10 bg-zinc-100 rounded-xl"></div>
            <div className="h-10 bg-zinc-100 rounded-xl"></div>
        </div>
    }

    if (activities.length === 0) {
        return <div className="text-center text-sm text-zinc-500 py-4">No activity recorded yet.</div>
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

    return (
        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-zinc-200 before:to-transparent">
            {activities.map((act) => (
                <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-indigo-50 text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <Activity className="w-4 h-4" />
                    </div>
                    {/* Card */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-zinc-100 bg-white shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                            <div className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                                {act.profiles?.avatar_url ? (
                                    <img src={act.profiles.avatar_url} className="w-5 h-5 rounded-full" alt="avatar" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center"><UserIcon className="w-3 h-3 text-zinc-400" /></div>
                                )}
                                {act.profiles?.display_name || 'Unknown User'}
                            </div>
                            <time className="text-xs font-medium text-zinc-400">
                                {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </time>
                        </div>
                        <div className="text-sm text-zinc-600">
                            {formatAction(act.action)}
                            {act.old_value && act.new_value && (
                                <span className="ml-1">from <span className="font-semibold text-zinc-800">{act.old_value}</span> to <span className="font-semibold text-zinc-800">{act.new_value}</span></span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
