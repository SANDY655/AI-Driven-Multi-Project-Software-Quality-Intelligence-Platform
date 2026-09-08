import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
    Mail, 
    Github, 
    Shield, 
    CheckCircle2, 
    Clock, 
    Award, 
    Laptop, 
    Activity,
    ExternalLink,
    Save,
    Loader2,
    Briefcase,
    Search,
    CheckSquare,
    Building,
    Terminal,
    Sparkles
} from 'lucide-react'
import { Link } from 'react-router-dom'

export function ProfilePage() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [assignedIssues, setAssignedIssues] = useState<any[]>([])
    const [activityLogs, setActivityLogs] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'activity' | 'settings'>('overview')
    const [workSearch, setWorkSearch] = useState('')
    
    // Editable profile fields
    const [displayName, setDisplayName] = useState('')
    const [githubUsername, setGithubUsername] = useState('')
    const [roleTitle, setRoleTitle] = useState('Senior Software Engineer')
    const [preferredIDE, setPreferredIDE] = useState('vscode')
    const [saving, setSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState('')

    useEffect(() => {
        if (!user) return
        loadProfileData()
    }, [user])

    async function loadProfileData() {
        if (!user) return
        setLoading(true)

        // 1. Fetch Profile
        const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()

        if (prof) {
            setProfile(prof)
            setDisplayName(prof.display_name || user.email?.split('@')[0] || '')
            setGithubUsername(prof.github_username || '')
        }

        const savedIDE = localStorage.getItem('preferred_ide') || 'vscode'
        setPreferredIDE(savedIDE)

        // 2. Fetch Assigned Tasks & Bugs
        const [tasksRes, bugsRes] = await Promise.all([
            supabase
                .from('tasks')
                .select('*, project:projects(id, name, project_code)')
                .eq('assigned_to', user.id)
                .order('created_at', { ascending: false }),
            supabase
                .from('bugs')
                .select('*, project:projects(id, name, project_code)')
                .eq('assigned_to', user.id)
                .order('created_at', { ascending: false })
        ])

        const formattedTasks = (tasksRes.data || []).map(t => ({
            ...t,
            itemType: 'task',
            title: t.title,
            displayId: `TASK-${t.id.slice(0, 4).toUpperCase()}`
        }))
        const formattedBugs = (bugsRes.data || []).map(b => ({
            ...b,
            itemType: 'bug',
            title: b.title,
            displayId: b.bug_display_id || `BUG-${b.id.slice(0, 4).toUpperCase()}`
        }))

        setAssignedIssues([...formattedBugs, ...formattedTasks])

        // 3. Fetch Activity Log
        const { data: logs } = await supabase
            .from('activity_log')
            .select('*, profiles:user_id(display_name), bugs(title, bug_display_id)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30)

        if (logs) setActivityLogs(logs)

        setLoading(false)
    }

    async function handleSaveSettings(e: React.FormEvent) {
        e.preventDefault()
        if (!user) return
        setSaving(true)
        setSaveMessage('')

        const { error } = await supabase
            .from('profiles')
            .update({
                display_name: displayName,
                github_username: githubUsername
            })
            .eq('id', user.id)

        localStorage.setItem('preferred_ide', preferredIDE)

        setSaving(false)
        if (error) {
            setSaveMessage(`Error: ${error.message}`)
        } else {
            setSaveMessage('Profile and preferences updated successfully!')
            setTimeout(() => setSaveMessage(''), 3000)
            loadProfileData()
        }
    }

    if (loading) {
        return (
            <div className="h-[calc(100vh-56px)] flex flex-col items-center justify-center bg-[#F4F5F7]">
                <Loader2 className="w-8 h-8 animate-spin text-[#0052CC] mb-2" />
                <span className="text-xs font-semibold text-[#5E6C84]">Loading Developer Profile...</span>
            </div>
        )
    }

    // Performance Calculations
    const totalAssigned = assignedIssues.length
    const completedCount = assignedIssues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase())).length
    const completionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 100
    const totalStoryPoints = assignedIssues.reduce((acc, curr) => acc + (Number(curr.story_points) || 0), 0)
    const totalSpentMins = assignedIssues.reduce((acc, curr) => acc + (Number(curr.time_spent) || 0), 0)
    const spentHours = Math.floor(totalSpentMins / 60)
    const spentMinsRemainder = totalSpentMins % 60

    // Filter work table
    const filteredWork = assignedIssues.filter(i => 
        i.title.toLowerCase().includes(workSearch.toLowerCase()) ||
        i.displayId.toLowerCase().includes(workSearch.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-[#F4F5F7] pb-12">
            
            {/* HERO COVER BANNER */}
            <div className="h-44 w-full bg-gradient-to-r from-[#0747A6] via-[#0052CC] to-[#6554C0] relative shadow-inner">
                <div className="max-w-6xl mx-auto h-full relative px-6">
                    <div className="absolute right-6 bottom-4 flex items-center gap-2">
                        <span className="bg-white/10 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5 text-[#FFAB00]" />
                            Enterprise Developer
                        </span>
                    </div>
                </div>
            </div>

            {/* PROFILE CARD & HEADER */}
            <div className="max-w-6xl mx-auto px-6 -mt-16 relative z-10 space-y-6">
                
                <div className="bg-white rounded-xl border border-[#DFE1E6] p-6 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-6">
                    
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-6">
                        {/* Avatar with Online Badge */}
                        <div className="relative -mt-14">
                            <div className="w-28 h-28 rounded-2xl bg-[#0052CC] text-white font-extrabold text-3xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    displayName.slice(0, 2).toUpperCase() || 'U'
                                )}
                            </div>
                            <span className="absolute bottom-1 right-1 w-4 h-4 bg-[#36B37E] border-2 border-white rounded-full shadow-xs" title="Online" />
                        </div>

                        {/* Title & Info */}
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-[#172B4D]">{displayName}</h1>
                                <span className="bg-[#DEEBFF] text-[#0052CC] text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <Shield className="w-3.5 h-3.5" />
                                    {profile?.role || 'Developer'}
                                </span>
                            </div>

                            <p className="text-xs font-semibold text-[#5E6C84] flex items-center gap-2">
                                <Briefcase className="w-3.5 h-3.5" />
                                {roleTitle}
                                <span>•</span>
                                <Building className="w-3.5 h-3.5" />
                                Engineering Dept
                            </p>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5E6C84] pt-1">
                                <span className="flex items-center gap-1">
                                    <Mail className="w-3.5 h-3.5 text-[#6B778C]" />
                                    {user?.email}
                                </span>
                                {githubUsername && (
                                    <a 
                                        href={`https://github.com/${githubUsername}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-[#0052CC] font-bold hover:underline"
                                    >
                                        <Github className="w-3.5 h-3.5" />
                                        @{githubUsername}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setActiveTab('settings')}
                            className="px-4 py-2 bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] border border-[#DFE1E6] text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
                        >
                            <Laptop className="w-4 h-4 text-[#0052CC]" />
                            Configure IDE & Settings
                        </button>
                    </div>
                </div>

                {/* PERFORMANCE METRICS GRID */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                            <span>Completed Work</span>
                            <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
                        </div>
                        <div className="text-2xl font-bold text-[#172B4D]">{completedCount} <span className="text-xs text-[#5E6C84]">/ {totalAssigned} items</span></div>
                        <div className="text-[11px] text-[#00875A] font-semibold">{completionRate}% Resolution Rate</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                            <span>Story Points Delivered</span>
                            <Award className="w-4 h-4 text-[#6554C0]" />
                        </div>
                        <div className="text-2xl font-bold text-[#172B4D]">{totalStoryPoints} <span className="text-xs text-[#5E6C84]">pts</span></div>
                        <div className="text-[11px] text-[#6554C0] font-semibold">Sprint Velocity</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                            <span>Work Time Logged</span>
                            <Clock className="w-4 h-4 text-[#0052CC]" />
                        </div>
                        <div className="text-2xl font-bold text-[#172B4D]">{spentHours}h {spentMinsRemainder}m</div>
                        <div className="text-[11px] text-[#0052CC] font-semibold">Total Logged Work</div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[#DFE1E6] shadow-xs space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                            <span>Default Dev Tool</span>
                            <Terminal className="w-4 h-4 text-[#FF8B00]" />
                        </div>
                        <div className="text-lg font-bold text-[#172B4D] capitalize truncate">{preferredIDE}</div>
                        <div className="text-[11px] text-[#5E6C84] font-medium">Auto Code Launcher</div>
                    </div>
                </div>

                {/* MAIN CONTENT TABS CONTAINER */}
                <div className="bg-white rounded-xl border border-[#DFE1E6] shadow-xs overflow-hidden">
                    
                    {/* Tab Navigation */}
                    <div className="border-b border-[#DFE1E6] px-6 flex gap-6 text-xs font-bold bg-[#FAFBFC]">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === 'overview' ? 'border-[#0052CC] text-[#0052CC]' : 'border-transparent text-[#5E6C84] hover:text-[#172B4D]'
                            }`}
                        >
                            <Activity className="w-4 h-4" /> Overview & Activity
                        </button>
                        <button
                            onClick={() => setActiveTab('work')}
                            className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === 'work' ? 'border-[#0052CC] text-[#0052CC]' : 'border-transparent text-[#5E6C84] hover:text-[#172B4D]'
                            }`}
                        >
                            <CheckSquare className="w-4 h-4" /> My Assigned Work ({assignedIssues.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`py-3.5 border-b-2 transition-colors flex items-center gap-2 ${
                                activeTab === 'settings' ? 'border-[#0052CC] text-[#0052CC]' : 'border-transparent text-[#5E6C84] hover:text-[#172B4D]'
                            }`}
                        >
                            <Laptop className="w-4 h-4" /> Preferences & Dev Tools
                        </button>
                    </div>

                    <div className="p-6">
                        {/* TAB 1: OVERVIEW & HEATMAP */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6">
                                
                                {/* Activity Contribution Grid (100% Real Database Data) */}
                                {(() => {
                                    // 1. Group real activity logs by YYYY-MM-DD
                                    const dailyActivityCounts: { [dateStr: string]: number } = {}
                                    activityLogs.forEach(log => {
                                        if (log.created_at) {
                                            const dateKey = new Date(log.created_at).toISOString().split('T')[0]
                                            dailyActivityCounts[dateKey] = (dailyActivityCounts[dateKey] || 0) + 1
                                        }
                                    })

                                    // 2. Generate 112 days (16 weeks x 7 days)
                                    const todayDate = new Date()
                                    const heatmapDays: { dateStr: string; count: number }[] = []
                                    for (let i = 111; i >= 0; i--) {
                                        const d = new Date(todayDate)
                                        d.setDate(todayDate.getDate() - i)
                                        const dateStr = d.toISOString().split('T')[0]
                                        heatmapDays.push({
                                            dateStr,
                                            count: dailyActivityCounts[dateStr] || 0
                                        })
                                    }

                                    return (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-[#0052CC]" />
                                                    Real Database Contribution & Activity Grid (16 Weeks)
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-[#5E6C84]">
                                                    <span>Less</span>
                                                    <div className="w-3 h-3 bg-[#EBECF0] rounded-xs" />
                                                    <div className="w-3 h-3 bg-[#99C2FF] rounded-xs" />
                                                    <div className="w-3 h-3 bg-[#4C9AFF] rounded-xs" />
                                                    <div className="w-3 h-3 bg-[#0052CC] rounded-xs" />
                                                    <span>More</span>
                                                </div>
                                            </div>

                                            <div className="bg-[#FAFBFC] border border-[#DFE1E6] p-4 rounded-lg overflow-x-auto">
                                                <div className="flex gap-1.5 min-w-[550px] justify-between">
                                                    {Array.from({ length: 16 }).map((_, weekIdx) => (
                                                        <div key={weekIdx} className="grid grid-rows-7 gap-1">
                                                            {Array.from({ length: 7 }).map((_, dayIdx) => {
                                                                const dayItem = heatmapDays[weekIdx * 7 + dayIdx]
                                                                const count = dayItem?.count || 0
                                                                const dateStr = dayItem?.dateStr || ''
                                                                return (
                                                                    <div 
                                                                        key={dayIdx} 
                                                                        className={`w-3.5 h-3.5 rounded-xs transition-all ${
                                                                            count >= 4 ? 'bg-[#0052CC]' :
                                                                            count >= 2 ? 'bg-[#4C9AFF]' :
                                                                            count === 1 ? 'bg-[#99C2FF]' :
                                                                            'bg-[#EBECF0]'
                                                                        }`} 
                                                                        title={`${dateStr}: ${count} activity record(s)`}
                                                                    />
                                                                )
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Recent Activity Feed */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-[#172B4D]">Recent Actions</h3>
                                    {activityLogs.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-[#5E6C84]">No recent activity logs recorded.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {activityLogs.slice(0, 5).map(log => (
                                                <div key={log.id} className="p-3 bg-[#FAFBFC] border border-[#DFE1E6] rounded-lg flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 bg-[#DEEBFF] text-[#0052CC] rounded-full">
                                                            <Activity className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-[#172B4D]">{log.action}</span>
                                                            {log.bugs?.bug_display_id && <span className="text-[#0052CC] font-semibold ml-1.5">on {log.bugs.bug_display_id}</span>}
                                                            {log.old_value && log.new_value && (
                                                                <span className="text-[#5E6C84] ml-2 font-mono">({log.old_value} → {log.new_value})</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] text-[#A5ADBA]">{new Date(log.created_at).toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: MY WORK TABLE */}
                        {activeTab === 'work' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                    <h3 className="text-sm font-bold text-[#172B4D]">All Work Items Assigned to You</h3>
                                    <div className="relative w-64">
                                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#5E6C84]" />
                                        <input 
                                            type="text" 
                                            placeholder="Search work items..."
                                            value={workSearch}
                                            onChange={e => setWorkSearch(e.target.value)}
                                            className="w-full bg-[#FAFBFC] border border-[#DFE1E6] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#172B4D] outline-none focus:border-[#0052CC]"
                                        />
                                    </div>
                                </div>

                                {filteredWork.length === 0 ? (
                                    <div className="py-12 text-center text-xs text-[#5E6C84] border border-dashed border-[#DFE1E6] rounded-lg">
                                        No work items match your search.
                                    </div>
                                ) : (
                                    <div className="border border-[#DFE1E6] rounded-lg overflow-hidden">
                                        <table className="w-full text-left text-xs text-[#172B4D]">
                                            <thead className="bg-[#FAFBFC] border-b border-[#DFE1E6] font-bold text-[#5E6C84] uppercase">
                                                <tr>
                                                    <th className="p-3">Key</th>
                                                    <th className="p-3">Title</th>
                                                    <th className="p-3">Project</th>
                                                    <th className="p-3">Type</th>
                                                    <th className="p-3">Priority</th>
                                                    <th className="p-3">Status</th>
                                                    <th className="p-3">Story Pts</th>
                                                    <th className="p-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[#DFE1E6]">
                                                {filteredWork.map(item => {
                                                    const isDone = ['done', 'resolved', 'closed'].includes(item.status?.toLowerCase())
                                                    return (
                                                        <tr key={item.id} className="hover:bg-[#FAFBFC] transition-colors">
                                                            <td className="p-3 font-bold text-[#0052CC]">{item.displayId}</td>
                                                            <td className="p-3 font-medium text-[#172B4D] max-w-xs truncate">{item.title}</td>
                                                            <td className="p-3 text-[#5E6C84]">{item.project?.name || 'Project'}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                                                    item.itemType === 'bug' ? 'bg-[#FFEBE6] text-[#DE350B]' : 'bg-[#DEEBFF] text-[#0052CC]'
                                                                }`}>{item.itemType}</span>
                                                            </td>
                                                            <td className="p-3 capitalize font-semibold">{item.priority || 'medium'}</td>
                                                            <td className="p-3">
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                                                    isDone ? 'bg-[#E3FCEF] text-[#00875A]' : 'bg-[#FFF0B3] text-[#172B4D]'
                                                                }`}>{item.status || 'todo'}</span>
                                                            </td>
                                                            <td className="p-3 font-bold">{item.story_points || 0} pts</td>
                                                            <td className="p-3 text-right">
                                                                <Link
                                                                    to={item.itemType === 'bug' ? `/projects/${item.project_id}/bugs/${item.id}` : `/projects/${item.project_id}/tasks`}
                                                                    className="text-[#0052CC] font-bold hover:underline inline-flex items-center gap-1"
                                                                >
                                                                    Open <ExternalLink className="w-3 h-3" />
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: SETTINGS & DEV TOOLS */}
                        {activeTab === 'settings' && (
                            <form onSubmit={handleSaveSettings} className="space-y-5 max-w-xl">
                                <h3 className="text-sm font-bold text-[#172B4D]">Account & Development Environment</h3>
                                
                                {saveMessage && (
                                    <div className="p-3 rounded text-xs font-bold bg-[#E3FCEF] text-[#00875A]">
                                        {saveMessage}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#5E6C84] uppercase">Display Name</label>
                                    <input 
                                        type="text"
                                        value={displayName}
                                        onChange={e => setDisplayName(e.target.value)}
                                        className="w-full border border-[#DFE1E6] rounded px-3 py-2 text-xs text-[#172B4D] outline-none focus:border-[#0052CC]"
                                        required
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#5E6C84] uppercase">GitHub Username</label>
                                    <input 
                                        type="text"
                                        value={githubUsername}
                                        onChange={e => setGithubUsername(e.target.value)}
                                        className="w-full border border-[#DFE1E6] rounded px-3 py-2 text-xs text-[#172B4D] outline-none focus:border-[#0052CC]"
                                        placeholder="e.g. octocat"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#5E6C84] uppercase">Default Development Environment / IDE</label>
                                    <select 
                                        value={preferredIDE}
                                        onChange={e => setPreferredIDE(e.target.value)}
                                        className="w-full border border-[#DFE1E6] rounded px-3 py-2 text-xs text-[#172B4D] outline-none focus:border-[#0052CC] bg-white font-medium"
                                    >
                                        <option value="vscode">VS Code (Visual Studio Code)</option>
                                        <option value="vscode-insiders">VS Code Insiders</option>
                                        <option value="cursor">Cursor AI Editor</option>
                                        <option value="webstorm">WebStorm</option>
                                        <option value="pycharm">PyCharm</option>
                                        <option value="intellij">IntelliJ IDEA</option>
                                        <option value="sublime">Sublime Text</option>
                                        <option value="github">GitHub Web</option>
                                    </select>
                                    <p className="text-[11px] text-[#5E6C84]">Opening source code files from bug reports will launch directly in your selected tool.</p>
                                </div>

                                <button 
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white font-bold rounded text-xs transition-colors flex items-center gap-2 shadow-xs"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Save Preferences
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
