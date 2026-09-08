import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
    Inbox as InboxIcon, 
    Bell, 
    CheckCheck, 
    AlertCircle, 
    Bug, 
    CheckSquare, 
    Clock, 
    Search,
    Loader2,
    ArrowRight,
    RefreshCw,
    Check
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function InboxPage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [notifications, setNotifications] = useState<any[]>([])
    const [activeFilter, setActiveFilter] = useState<'all' | 'assigned' | 'sla' | 'timelog' | 'status'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [readIds, setReadIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!user) return
        loadInboxData()
    }, [user])

    async function loadInboxData() {
        setLoading(true)
        // Fetch activity logs safely without non-existent columns
        const { data, error } = await supabase
            .from('activity_log')
            .select(`
                id, action, old_value, new_value, created_at,
                profiles:user_id (display_name, avatar_url),
                bugs:bug_id (id, bug_display_id, title, project_id)
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (error) {
            console.error('Error fetching inbox notifications:', error)
        }

        if (data) {
            setNotifications(data)
        }
        setLoading(false)
    }

    function markAllAsRead() {
        const allIds = new Set(notifications.map(n => n.id))
        setReadIds(allIds)
    }

    function toggleRead(id: string) {
        setReadIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function getRelativeTime(dateStr: string) {
        const d = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - d.getTime()
        const diffMins = Math.floor(diffMs / (1000 * 60))
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays === 1) return 'Yesterday'
        return `${diffDays}d ago`
    }

    if (loading) {
        return (
            <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-[#F4F5F7]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
                    <span className="text-sm font-semibold text-[#5E6C84]">Loading Inbox Notifications...</span>
                </div>
            </div>
        )
    }

    // Filtering logic
    const filteredNotifs = notifications.filter(n => {
        const textToSearch = `${n.profiles?.display_name || ''} ${n.action} ${n.bugs?.bug_display_id || ''} ${n.bugs?.title || ''}`.toLowerCase()
        if (searchQuery && !textToSearch.includes(searchQuery.toLowerCase())) {
            return false
        }

        if (activeFilter === 'sla') {
            return n.action?.toLowerCase().includes('sla') || n.action?.toLowerCase().includes('breach')
        }
        if (activeFilter === 'timelog') {
            return n.action?.toLowerCase().includes('time') || n.action?.toLowerCase().includes('estimate') || n.action?.toLowerCase().includes('spent')
        }
        if (activeFilter === 'status') {
            return n.action?.toLowerCase().includes('status') || n.action?.toLowerCase().includes('state')
        }

        return true
    })

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length

    return (
        <div className="h-[calc(100vh-56px)] flex bg-[#F4F5F7] overflow-hidden">
            
            {/* LEFT FILTER SIDEBAR */}
            <aside className="w-72 bg-white border-r border-[#DFE1E6] flex flex-col flex-shrink-0 z-10 shadow-sm">
                
                {/* Inbox Sidebar Header */}
                <div className="p-5 border-b border-[#DFE1E6] space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#DEEBFF] text-[#0052CC] rounded-lg shadow-sm">
                                <InboxIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-base font-bold text-[#172B4D]">Notification Center</h1>
                                <p className="text-xs text-[#5E6C84]">Stay updated on issues & work ({unreadCount} unread)</p>
                            </div>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5E6C84]" />
                        <input
                            type="text"
                            placeholder="Filter notifications..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#172B4D] placeholder:text-[#5E6C84] outline-none focus:border-[#0052CC] focus:bg-white transition-all"
                        />
                    </div>
                </div>

                {/* Filter List */}
                <div className="flex-1 p-3 space-y-1 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider">
                        Views & Categories
                    </div>

                    <button
                        onClick={() => setActiveFilter('all')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-colors ${
                            activeFilter === 'all'
                                ? 'bg-[#DEEBFF] text-[#0052CC]'
                                : 'text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Bell className="w-4 h-4" />
                            <span>All Activity</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeFilter === 'all' ? 'bg-[#0052CC] text-white' : 'bg-[#DFE1E6] text-[#42526E]'
                        }`}>
                            {notifications.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveFilter('timelog')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-colors ${
                            activeFilter === 'timelog'
                                ? 'bg-[#DEEBFF] text-[#0052CC]'
                                : 'text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-[#0052CC]" />
                            <span>Time & Work Logs</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveFilter('status')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-colors ${
                            activeFilter === 'status'
                                ? 'bg-[#DEEBFF] text-[#0052CC]'
                                : 'text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <CheckSquare className="w-4 h-4 text-[#00875A]" />
                            <span>Status Changes</span>
                        </div>
                    </button>

                    <button
                        onClick={() => setActiveFilter('sla')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold transition-colors ${
                            activeFilter === 'sla'
                                ? 'bg-[#FFEBE6] text-[#DE350B]'
                                : 'text-[#42526E] hover:bg-[#F4F5F7] hover:text-[#172B4D]'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <AlertCircle className="w-4 h-4 text-[#DE350B]" />
                            <span>SLA & Urgent Alerts</span>
                        </div>
                    </button>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-[#DFE1E6] bg-[#FAFBFC]">
                    <button
                        onClick={markAllAsRead}
                        className="w-full py-2 bg-white border border-[#DFE1E6] hover:bg-[#EBECF0] text-[#172B4D] text-xs font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCheck className="w-4 h-4 text-[#0052CC]" />
                        Mark All as Read
                    </button>
                </div>
            </aside>

            {/* RIGHT MAIN NOTIFICATION CONTENT */}
            <main className="flex-1 flex flex-col bg-white overflow-hidden">
                
                {/* Top Action Bar */}
                <div className="px-6 py-4 border-b border-[#DFE1E6] bg-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-[#172B4D] capitalize">
                            {activeFilter === 'all' ? 'All Notifications' : `${activeFilter} Updates`}
                        </h2>
                        <span className="text-xs text-[#5E6C84] bg-[#F4F5F7] px-2.5 py-1 rounded-full font-medium">
                            Showing {filteredNotifs.length} items
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadInboxData}
                            className="px-3 py-1.5 text-xs font-semibold text-[#42526E] hover:text-[#172B4D] hover:bg-[#F4F5F7] rounded border border-[#DFE1E6] transition-colors flex items-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Notifications List Body */}
                <div className="flex-1 overflow-y-auto divide-y divide-[#DFE1E6]">
                    {filteredNotifs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-[#F4F5F7] flex items-center justify-center text-[#A5ADBA]">
                                <InboxIcon className="w-8 h-8 opacity-60" />
                            </div>
                            <div className="max-w-md space-y-1">
                                <h3 className="text-base font-bold text-[#172B4D]">No notifications found</h3>
                                <p className="text-xs text-[#5E6C84]">
                                    {searchQuery
                                        ? `No updates match "${searchQuery}". Try searching for something else.`
                                        : 'You are all caught up! New issue activity and mentions will appear here.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredNotifs.map((n) => {
                            const isRead = readIds.has(n.id)
                            const actionLower = n.action.toLowerCase()

                            // Icon logic based on action type
                            let ActionIcon = Bell
                            let iconBg = 'bg-[#DEEBFF]'
                            let iconColor = 'text-[#0052CC]'

                            if (actionLower.includes('time') || actionLower.includes('spent') || actionLower.includes('estimate')) {
                                ActionIcon = Clock
                                iconBg = 'bg-[#EAE6FF]'
                                iconColor = 'text-[#6554C0]'
                            } else if (actionLower.includes('sla') || actionLower.includes('breach')) {
                                ActionIcon = AlertCircle
                                iconBg = 'bg-[#FFEBE6]'
                                iconColor = 'text-[#DE350B]'
                            } else if (actionLower.includes('status') || actionLower.includes('resolved')) {
                                ActionIcon = CheckSquare
                                iconBg = 'bg-[#E3FCEF]'
                                iconColor = 'text-[#00875A]'
                            }

                            return (
                                <div 
                                    key={n.id}
                                    className={`p-4 px-6 hover:bg-[#FAFBFC] transition-colors flex items-start justify-between gap-4 border-l-4 ${
                                        isRead ? 'border-l-transparent opacity-75' : 'border-l-[#0052CC] bg-[#F4F5F7]/30'
                                    }`}
                                >
                                    <div className="flex items-start gap-4 flex-1 min-w-0">
                                        {/* Avatar & Badge */}
                                        <div className="relative flex-shrink-0 mt-0.5">
                                            {n.profiles?.avatar_url ? (
                                                <img src={n.profiles.avatar_url} alt="" className="w-10 h-10 rounded-full border border-[#DFE1E6] object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-[#0052CC] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                                                    {(n.profiles?.display_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white ${iconBg} ${iconColor} border-2 border-white shadow-xs`}>
                                                <ActionIcon className="w-3 h-3" />
                                            </div>
                                        </div>

                                        {/* Content details */}
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 text-sm text-[#172B4D]">
                                                <span className="font-bold text-[#172B4D]">{n.profiles?.display_name || 'Someone'}</span>
                                                <span className="text-[#5E6C84] font-medium">{n.action.replace(/_/g, ' ')}</span>
                                                {n.bugs?.bug_display_id && (
                                                    <span className="px-2 py-0.5 bg-[#DEEBFF] text-[#0052CC] font-bold text-xs rounded border border-[#0052CC]/20 inline-flex items-center gap-1">
                                                        <Bug className="w-3 h-3" />
                                                        {n.bugs.bug_display_id}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Bug Title */}
                                            {n.bugs?.title && (
                                                <div className="text-xs font-semibold text-[#172B4D] truncate">
                                                    {n.bugs.title}
                                                </div>
                                            )}

                                            {/* Field Value Diff Tag */}
                                            {(n.old_value || n.new_value) && (
                                                <div className="flex items-center gap-2 text-xs text-[#5E6C84] bg-[#F4F5F7] px-3 py-1 rounded border border-[#DFE1E6] inline-block font-mono">
                                                    <span className="text-[#DE350B] line-through">{n.old_value || 'None'}</span>
                                                    <span>→</span>
                                                    <span className="text-[#00875A] font-bold">{n.new_value || 'None'}</span>
                                                </div>
                                            )}

                                            <div className="text-[11px] text-[#A5ADBA] font-medium">
                                                {getRelativeTime(n.created_at)} • {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => toggleRead(n.id)}
                                            className="p-1.5 text-[#5E6C84] hover:text-[#172B4D] hover:bg-[#EBECF0] rounded transition-colors"
                                            title={isRead ? 'Mark as Unread' : 'Mark as Read'}
                                        >
                                            <Check className={`w-4 h-4 ${isRead ? 'text-[#00875A]' : 'opacity-40'}`} />
                                        </button>

                                        {n.bugs?.id && n.bugs?.project_id && (
                                            <Link
                                                to={`/projects/${n.bugs.project_id}/bugs/${n.bugs.id}`}
                                                className="px-3 py-1.5 bg-[#0052CC] hover:bg-[#0047B3] text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1.5"
                                            >
                                                Open <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
    )
}
