import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
    Calendar as CalendarIcon, 
    Layers, 
    Zap, 
    Loader2
} from 'lucide-react'

function getValidDateStr(dateValue: any, fallbackOffsetDays = 0): string {
    try {
        if (dateValue) {
            const parsed = new Date(dateValue)
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0]
            }
        }
    } catch {
        // Fall back to today + offset
    }
    const d = new Date()
    d.setDate(d.getDate() + fallbackOffsetDays)
    return d.toISOString().split('T')[0]
}

export function TimelinePage() {
    const { id } = useParams<{ id: string }>()
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<any>(null)
    const [sprints, setSprints] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    const [issues, setIssues] = useState<any[]>([])

    // Timeline view settings
    const [zoomLevel, setZoomLevel] = useState<'weeks' | 'months' | 'quarter'>('weeks')
    const [viewMode, setViewMode] = useState<'all' | 'sprints' | 'epics'>('all')

    useEffect(() => {
        if (!id) return
        loadTimelineData()
    }, [id])

    async function loadTimelineData() {
        setLoading(true)
        try {
            const [pRes, sRes, eRes, tRes, bRes] = await Promise.all([
                supabase.from('projects').select('*').eq('id', id).single(),
                supabase.from('sprints').select('*').eq('project_id', id).order('created_at', { ascending: true }),
                supabase.from('epics').select('*').eq('project_id', id).order('created_at', { ascending: true }),
                supabase.from('tasks').select('*').eq('project_id', id),
                supabase.from('bugs').select('*').eq('project_id', id)
            ])

            if (pRes.data) setProject(pRes.data)
            if (sRes.data) setSprints(sRes.data)
            if (eRes.data) setEpics(eRes.data)
            
            const allIssues = [
                ...(tRes.data || []).map(t => ({ ...t, type: 'task' })),
                ...(bRes.data || []).map(b => ({ ...b, type: 'bug' }))
            ]
            setIssues(allIssues)
        } catch (err) {
            console.error('Error loading timeline data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function updateSprintDates(sprintId: string, startDate: string, endDate: string) {
        await supabase.from('sprints').update({ start_date: startDate, end_date: endDate }).eq('id', sprintId)
        loadTimelineData()
    }

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
            </div>
        )
    }

    // Generate timeline headers (weeks/months grid)
    const today = new Date()
    const timelineDays: Date[] = []
    const totalDaysToDisplay = zoomLevel === 'weeks' ? 28 : zoomLevel === 'months' ? 60 : 90
    
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 7) // start 7 days ago

    for (let i = 0; i < totalDaysToDisplay; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        timelineDays.push(d)
    }

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-[#F4F5F7] overflow-hidden">
            {/* Header Controls Bar (Sticky Top) */}
            <div className="bg-white border-b border-[#DFE1E6] px-6 py-4 flex flex-wrap items-center justify-between gap-4 flex-shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#DEEBFF] text-[#0052CC] rounded">
                        <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-[#172B4D] flex items-center gap-2">
                            {project?.name || 'Project'} — Sprint & Epic Timeline
                        </h1>
                        <p className="text-xs text-[#5E6C84]">Gantt roadmap of Sprints, Epics, and release schedules.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Filter */}
                    <div className="flex items-center bg-[#EBECF0] p-1 rounded">
                        <button 
                            onClick={() => setViewMode('all')}
                            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${viewMode === 'all' ? 'bg-white text-[#172B4D] shadow-sm' : 'text-[#5E6C84]'}`}
                        >
                            All ({sprints.length + epics.length})
                        </button>
                        <button 
                            onClick={() => setViewMode('sprints')}
                            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${viewMode === 'sprints' ? 'bg-white text-[#172B4D] shadow-sm' : 'text-[#5E6C84]'}`}
                        >
                            Sprints ({sprints.length})
                        </button>
                        <button 
                            onClick={() => setViewMode('epics')}
                            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${viewMode === 'epics' ? 'bg-white text-[#172B4D] shadow-sm' : 'text-[#5E6C84]'}`}
                        >
                            Epics ({epics.length})
                        </button>
                    </div>

                    {/* Zoom Selector */}
                    <div className="flex items-center bg-[#EBECF0] p-1 rounded">
                        <button 
                            onClick={() => setZoomLevel('weeks')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${zoomLevel === 'weeks' ? 'bg-white text-[#0052CC] shadow-sm' : 'text-[#5E6C84]'}`}
                        >
                            4 Weeks
                        </button>
                        <button 
                            onClick={() => setZoomLevel('months')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${zoomLevel === 'months' ? 'bg-white text-[#0052CC] shadow-sm' : 'text-[#5E6C84]'}`}
                        >
                            2 Months
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Scrollable Canvas */}
            <div className="flex-1 overflow-auto bg-white relative">
                <div className="min-w-[1200px] divide-y divide-[#DFE1E6]">
                    {/* Date Header Row */}
                    <div className="flex sticky top-0 bg-[#FAFBFC] border-b border-[#DFE1E6] z-10 font-semibold text-xs text-[#5E6C84]">
                        <div className="w-80 p-3 flex-shrink-0 border-r border-[#DFE1E6] sticky left-0 bg-[#FAFBFC] z-20 shadow-sm">
                            Work Item / Roadmap
                        </div>
                        <div className="flex-1 flex overflow-hidden">
                            {timelineDays.map((day, idx) => {
                                const isToday = day.toDateString() === today.toDateString()
                                const isWeekend = day.getDay() === 0 || day.getDay() === 6
                                return (
                                    <div 
                                        key={idx} 
                                        className={`flex-1 border-r border-[#DFE1E6]/50 text-center py-2 text-[10px] min-w-[36px] flex flex-col justify-center ${
                                            isToday ? 'bg-[#DEEBFF] text-[#0052CC] font-bold' : isWeekend ? 'bg-[#F4F5F7]' : ''
                                        }`}
                                    >
                                        <span>{day.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                                        <span className="font-bold">{day.getDate()}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* SPRINTS SECTION */}
                    {(viewMode === 'all' || viewMode === 'sprints') && (
                        <div>
                            <div className="bg-[#FAFBFC] px-4 py-2 text-xs font-bold text-[#5E6C84] uppercase tracking-wider flex items-center gap-2 border-b border-[#DFE1E6]">
                                <Zap className="w-4 h-4 text-[#0052CC]" /> Sprints
                            </div>

                            {sprints.length === 0 ? (
                                <div className="p-6 text-center text-sm text-[#5E6C84]">
                                    No sprints created yet. Go to <span className="font-semibold">Backlog</span> to create your first sprint.
                                </div>
                            ) : (
                                sprints.map((sprint) => {
                                    const sprintIssues = issues.filter(i => i.sprint_id === sprint.id)
                                    const doneIssues = sprintIssues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase()))
                                    const progressPct = sprintIssues.length > 0 ? Math.round((doneIssues.length / sprintIssues.length) * 100) : 0

                                    const sDateStr = getValidDateStr(sprint.start_date, 0)
                                    const eDateStr = getValidDateStr(sprint.end_date, 14)

                                    return (
                                        <div key={sprint.id} className="flex items-center hover:bg-[#FAFBFC] transition-colors border-b border-[#DFE1E6]">
                                            {/* Left sidebar info */}
                                            <div className="w-80 p-3 flex-shrink-0 border-r border-[#DFE1E6] sticky left-0 bg-white z-10 shadow-sm space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm text-[#172B4D] truncate">{sprint.name}</span>
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                                                        sprint.status === 'active' ? 'bg-[#DEEBFF] text-[#0052CC]' : sprint.status === 'completed' ? 'bg-[#E3FCEF] text-[#00875A]' : 'bg-[#DFE1E6] text-[#42526E]'
                                                    }`}>
                                                        {sprint.status || 'planned'}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-[#5E6C84]">
                                                    <span>{sprintIssues.length} items</span>
                                                    <span>•</span>
                                                    <span className="text-[#00875A] font-semibold">{progressPct}% Done</span>
                                                </div>

                                                {/* Inline Date Inputs */}
                                                <div className="flex items-center gap-1.5 text-[11px] text-[#5E6C84]">
                                                    <input 
                                                        type="date"
                                                        value={sDateStr}
                                                        onChange={(e) => updateSprintDates(sprint.id, e.target.value, eDateStr)}
                                                        className="border border-[#DFE1E6] rounded px-1 text-[11px] bg-white outline-none focus:border-[#0052CC]"
                                                    />
                                                    <span>→</span>
                                                    <input 
                                                        type="date"
                                                        value={eDateStr}
                                                        onChange={(e) => updateSprintDates(sprint.id, sDateStr, e.target.value)}
                                                        className="border border-[#DFE1E6] rounded px-1 text-[11px] bg-white outline-none focus:border-[#0052CC]"
                                                    />
                                                </div>
                                            </div>

                                            {/* Gantt Bar Grid */}
                                            <div className="flex-1 flex items-center p-3 relative h-16">
                                                <div className="w-full bg-[#FAFBFC] border border-dashed border-[#DFE1E6] rounded h-8 relative overflow-hidden flex items-center px-3">
                                                    <div 
                                                        className={`h-full absolute left-0 top-0 transition-all rounded ${
                                                            sprint.status === 'active' ? 'bg-[#0052CC]' : sprint.status === 'completed' ? 'bg-[#00875A]' : 'bg-[#6554C0]'
                                                        }`}
                                                        style={{ width: `${Math.max(5, progressPct)}%` }}
                                                    />
                                                    <span className="relative z-10 text-xs font-bold text-white drop-shadow">
                                                        {sprint.name} ({progressPct}% Complete)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}

                    {/* EPICS SECTION */}
                    {(viewMode === 'all' || viewMode === 'epics') && (
                        <div>
                            <div className="bg-[#FAFBFC] px-4 py-2 text-xs font-bold text-[#5E6C84] uppercase tracking-wider flex items-center gap-2 border-b border-[#DFE1E6]">
                                <Layers className="w-4 h-4 text-[#6554C0]" /> Epics
                            </div>

                            {epics.length === 0 ? (
                                <div className="p-6 text-center text-sm text-[#5E6C84]">
                                    No epics created yet.
                                </div>
                            ) : (
                                epics.map((epic) => {
                                    const epicIssues = issues.filter(i => i.epic_id === epic.id)
                                    const doneEpicIssues = epicIssues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase()))
                                    const epicPct = epicIssues.length > 0 ? Math.round((doneEpicIssues.length / epicIssues.length) * 100) : 0

                                    return (
                                        <div key={epic.id} className="flex items-center hover:bg-[#FAFBFC] transition-colors border-b border-[#DFE1E6]">
                                            <div className="w-80 p-3 flex-shrink-0 border-r border-[#DFE1E6] sticky left-0 bg-white z-10 shadow-sm space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-bold text-sm text-[#172B4D] truncate">{epic.name}</span>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-[#EAE6FF] text-[#6554C0]">
                                                        {epic.status || 'planned'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-[#5E6C84]">
                                                    {epicIssues.length} grouped issues • {epicPct}% Done
                                                </div>
                                            </div>

                                            <div className="flex-1 flex items-center p-3 relative h-14">
                                                <div className="w-full bg-[#EAE6FF]/40 border border-[#6554C0]/30 rounded h-7 relative overflow-hidden flex items-center px-3">
                                                    <div 
                                                        className="h-full absolute left-0 top-0 bg-[#6554C0] transition-all rounded"
                                                        style={{ width: `${Math.max(5, epicPct)}%` }}
                                                    />
                                                    <span className="relative z-10 text-xs font-bold text-[#172B4D]">
                                                        {epic.name}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
