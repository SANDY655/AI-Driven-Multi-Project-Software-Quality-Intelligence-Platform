import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { TaskCard, type Task } from '../components/projects/tasks/TaskCard'
import { BugCard, type Bug } from '../components/projects/BugCard'
import { TaskDetailsModal } from '../components/projects/tasks/TaskDetailsModal'
import { BugDetailsModal } from '../components/projects/BugDetailsModal'
import { ProjectAutomationModal } from '../components/projects/ProjectAutomationModal'
import {
    Sparkles, Plus, Target, ListOrdered, Zap, Calendar, Search, Download, Upload
} from 'lucide-react'

type Issue =
    | { type: 'task', id: string, data: Task }
    | { type: 'bug', id: string, data: Bug }

function getValidDateStr(dateValue: any, fallbackOffsetDays = 0): string {
    try {
        if (dateValue) {
            const parsed = new Date(dateValue)
            if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0]
            }
        }
    } catch {
        // Fallback
    }
    const d = new Date()
    d.setDate(d.getDate() + fallbackOffsetDays)
    return d.toISOString().split('T')[0]
}

export function BacklogPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [project, setProject] = useState<any>(null)
    const [issues, setIssues] = useState<Issue[]>([])
    const [sprints, setSprints] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    const [isPlanning, setIsPlanning] = useState(false)
    const [isGeneratingEpics, setIsGeneratingEpics] = useState(false)
    const [members, setMembers] = useState<any[]>([])
    const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
    const [epicFilter, setEpicFilter] = useState<string | null>(null)
    const [sprintViewFilter, setSprintViewFilter] = useState<string>('all')

    // Selected issue detail modal states
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [selectedBugId, setSelectedBugId] = useState<string | null>(null)

    // Quick Filters & Search
    const [searchQuery, setSearchQuery] = useState('')
    const [onlyMyIssues, setOnlyMyIssues] = useState(false)
    const [highPriorityOnly, setHighPriorityOnly] = useState(false)
    const [unassignedOnly, setUnassignedOnly] = useState(false)

    // Automation Modal
    const [automationModalOpen, setAutomationModalOpen] = useState(false)

    // File Input Ref for CSV Import
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Epic creation
    const [creatingEpic, setCreatingEpic] = useState(false)
    const [newEpicName, setNewEpicName] = useState('')
    const [savingEpic, setSavingEpic] = useState(false)

    // Complete sprint modal
    const [completingSprintId, setCompletingSprintId] = useState<string | null>(null)

    useEffect(() => { loadData() }, [id])

    async function loadData() {
        if (!id) return
        supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => setProject(data))
        const { data: sprintsData } = await supabase.from('sprints').select('*').eq('project_id', id).order('created_at', { ascending: true })
        if (sprintsData) setSprints(sprintsData)
        const { data: epicsData } = await supabase.from('epics').select('*').eq('project_id', id).order('created_at', { ascending: true })
        if (epicsData) setEpics(epicsData)
        const { data: membersData } = await supabase.from('project_members').select(`profiles (id, display_name, avatar_url)`).eq('project_id', id)
        if (membersData) setMembers(membersData.map((m: any) => m.profiles).filter(Boolean))
        try {
            const [tasksRes, bugsRes] = await Promise.all([
                supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(display_name, avatar_url), epic:epics(id, name), resolved_at').eq('project_id', id),
                supabase.from('bugs').select('*, assignee:profiles!bugs_assigned_to_fkey(display_name, avatar_url), epic:epics(id, name), resolved_at').eq('project_id', id)
            ])
            const taskIssues: Issue[] = (tasksRes.data || []).map((t: any) => ({ type: 'task', id: `task-${t.id}`, data: t }))
            const bugIssues: Issue[] = (bugsRes.data || []).map((b: any) => ({ type: 'bug', id: `bug-${b.id}`, data: b }))
            setIssues([...taskIssues, ...bugIssues])
        } catch (e) {
            console.error('Error loading backlog issues:', e)
        }
    }

    async function onDragEnd(result: DropResult) {
        const { destination, source, draggableId } = result
        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        const isTask = draggableId.startsWith('task-')
        const rawId = draggableId.replace(/^(task|bug)-/, '')
        const targetSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId

        setIssues(prev => prev.map(issue => {
            if (issue.id === draggableId) {
                return { ...issue, data: { ...issue.data, sprint_id: targetSprintId } as any }
            }
            return issue
        }))

        await supabase.from(isTask ? 'tasks' : 'bugs').update({ sprint_id: targetSprintId }).eq('id', rawId)
        loadData()
    }

    async function createSprint() {
        if (!id) return
        const count = sprints.length + 1
        const { data } = await supabase.from('sprints').insert({ project_id: id, name: `Sprint ${count}`, status: 'planned' }).select().single()
        if (data) setSprints(prev => [...prev, data])
    }

    async function startSprint(sprintId: string) {
        const startDate = new Date().toISOString().split('T')[0]
        const endDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
        await supabase.from('sprints').update({ status: 'active', start_date: startDate, end_date: endDate }).eq('id', sprintId)
        loadData()
    }

    async function updateSprintDates(sprintId: string, startDate: string, endDate: string) {
        await supabase.from('sprints').update({ start_date: startDate, end_date: endDate }).eq('id', sprintId)
        loadData()
    }

    async function completeSprint(sprintId: string) {
        const sprintIssues = issues.filter(i => (i.data as any).sprint_id === sprintId)
        const unfinished = sprintIssues.filter(i => {
            const s = (i.data as any).status
            return s !== 'closed' && s !== 'resolved' && s !== 'done'
        })
        for (const issue of unfinished) {
            const isTask = issue.type === 'task'
            const rawId = issue.data.id
            await supabase.from(isTask ? 'tasks' : 'bugs').update({ sprint_id: null }).eq('id', rawId)
        }
        await supabase.from('sprints').update({ status: 'completed', end_date: new Date().toISOString().split('T')[0] }).eq('id', sprintId)
        setCompletingSprintId(null)
        loadData()
    }

    async function createEpic() {
        if (!newEpicName.trim() || !id) return
        setSavingEpic(true)
        try {
            const { error } = await supabase.from('epics').insert({ 
                project_id: id, 
                name: newEpicName.trim(),
                status: 'planned'
            })
            if (error) {
                console.error('Error creating epic:', error)
                alert(`Failed to create epic: ${error.message}`)
            } else {
                setNewEpicName('')
                setCreatingEpic(false)
                loadData()
            }
        } catch (err: any) {
            console.error('Failed to create epic:', err)
        } finally {
            setSavingEpic(false)
        }
    }

    async function handleAutoPlan(sprintId: string) {
        setIsPlanning(true)
        try {
            const backlog = issues.filter(i => !(i.data as any).sprint_id)
            const toPlan = backlog.slice(0, 5)
            for (const issue of toPlan) {
                await supabase.from(issue.type === 'task' ? 'tasks' : 'bugs').update({ sprint_id: sprintId }).eq('id', issue.data.id)
            }
            await loadData()
        } finally { setIsPlanning(false) }
    }

    async function handleGenerateEpics() {
        setIsGeneratingEpics(true)
        try {
            await supabase.from('epics').insert([
                { project_id: id, name: 'Authentication & Security', status: 'planned' },
                { project_id: id, name: 'Performance Improvements', status: 'planned' },
                { project_id: id, name: 'UI / UX Enhancements', status: 'planned' }
            ])
            await loadData()
        } finally { setIsGeneratingEpics(false) }
    }

    function exportToCSV() {
        if (!issues.length) return alert('No issues to export.')
        const headers = ['Type', 'ID', 'Display Key', 'Title', 'Priority', 'Status', 'Story Points', 'Estimate (m)', 'Logged (m)']
        const rows = issues.map(i => {
            const data: any = i.data
            const displayId = i.type === 'task' ? data.task_display_id : data.bug_display_id
            return [
                i.type.toUpperCase(),
                data.id,
                displayId || '',
                `"${(data.title || '').replace(/"/g, '""')}"`,
                data.priority || 'medium',
                data.status || 'todo',
                data.story_points || 0,
                data.original_estimate || 0,
                data.time_spent || 0
            ].join(',')
        })
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `${project?.project_code || 'Jira'}_backlog_export.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !id) return
        const reader = new FileReader()
        reader.onload = async (evt) => {
            const text = evt.target?.result as string
            if (!text) return
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
            if (lines.length <= 1) return alert('CSV file is empty or missing data.')
            
            const newTasks = []
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',')
                if (cols.length >= 4) {
                    const title = cols[3]?.replace(/^"|"$/g, '') || cols[2] || `Imported Issue ${i}`
                    newTasks.push({
                        project_id: id,
                        title: title,
                        description: 'Imported from Jira CSV',
                        priority: cols[4] ? cols[4].toLowerCase() : 'medium',
                        status: 'todo',
                        story_points: parseInt(cols[6]) || 0
                    })
                }
            }
            if (newTasks.length > 0) {
                const { error } = await supabase.from('tasks').insert(newTasks)
                if (!error) {
                    alert(`Successfully imported ${newTasks.length} issues into Backlog!`)
                    loadData()
                } else {
                    alert(`Failed to import issues: ${error.message}`)
                }
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    function IssueRow({ item, index }: { item: Issue, index: number }) {
        if (item.type === 'task') {
            return (
                <TaskCard
                    task={item.data}
                    index={index}
                    onClick={() => setSelectedTaskId(item.data.id)}
                />
            )
        }
        return (
            <BugCard
                bug={item.data}
                index={index}
                onClick={() => setSelectedBugId(item.data.id)}
            />
        )
    }

    if (!project) return null

    const filtered = issues.filter(i => {
        const data: any = i.data
        if (assigneeFilter && data.assigned_to !== assigneeFilter) return false
        if (epicFilter && data.epic?.id !== epicFilter) return false

        // Quick Filters
        if (onlyMyIssues && user?.id && data.assigned_to !== user.id) return false
        if (highPriorityOnly && data.priority !== 'high' && data.priority !== 'urgent') return false
        if (unassignedOnly && data.assigned_to) return false
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            const key = (i.type === 'task' ? data.task_display_id : data.bug_display_id) || ''
            const title = (data.title || '').toLowerCase()
            if (!key.toLowerCase().includes(q) && !title.includes(q)) return false
        }
        return true
    })

    const backlogIssues = filtered.filter(i => !(i.data as any).sprint_id)

    const sprintIssueCount = (sprintId: string) => issues.filter(i => (i.data as any).sprint_id === sprintId).length
    const sprintPoints = (sprintId: string) => issues.filter(i => (i.data as any).sprint_id === sprintId).reduce((acc, i) => acc + ((i.data as any).story_points || 0), 0)
    const sprintDoneCount = (sprintId: string) => issues.filter(i => {
        if ((i.data as any).sprint_id !== sprintId) return false
        const s = (i.data as any).status
        return s === 'closed' || s === 'resolved' || s === 'done'
    }).length

    const issueCountByEpic = (epicId: string) => issues.filter(i => (i.data as any).epic?.id === epicId).length

    const filteredSprints = sprints.filter(s => {
        if (sprintViewFilter === 'active') return s.status === 'active'
        if (sprintViewFilter === 'planned') return s.status === 'planned' || !s.status
        return true
    })

    // Timeline days
    const today = new Date()
    const timelineDays: Date[] = []
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 5)
    for (let i = 0; i < 21; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        timelineDays.push(d)
    }

    return (
        <div className="h-[calc(100vh-56px)] flex flex-col bg-white overflow-hidden">

            {/* TOP BAR */}
            <div className="px-6 py-3 border-b border-[#DFE1E6] flex flex-col gap-3 flex-shrink-0 bg-white z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center text-xs text-[#5E6C84]">
                            <Link to="/projects" className="hover:underline">Projects</Link>
                            <span className="mx-2">/</span>
                            <Link to={`/projects/${id}`} className="hover:underline">{project.name}</Link>
                            <span className="mx-2">/</span>
                            <span className="text-[#172B4D] font-bold">Backlog & Roadmap</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Member Filter Chips */}
                        <div className="flex items-center gap-1.5 mr-2">
                            {members.map(m => (
                                <button key={m.id} onClick={() => setAssigneeFilter(assigneeFilter === m.id ? null : m.id)}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all text-xs ${assigneeFilter === m.id ? 'bg-[#DEEBFF] ring-2 ring-[#0052CC]' : 'hover:bg-[#EBECF0]'}`}
                                    title={m.display_name}>
                                    {m.avatar_url ? <img src={m.avatar_url} className="w-4 h-4 rounded-full" alt="" /> :
                                        <div className="w-4 h-4 rounded-full bg-[#0052CC] text-white text-[9px] font-bold flex items-center justify-center">{m.display_name?.charAt(0)}</div>}
                                    <span className="text-[#172B4D] font-medium">{m.display_name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Jira Automation Engine Trigger */}
                        <button
                            onClick={() => setAutomationModalOpen(true)}
                            className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold rounded transition-all flex items-center gap-1.5 shadow-xs"
                            title="Configure Jira Automation Rules"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Automation Rules</span>
                        </button>

                        {/* CSV Import/Export */}
                        <button
                            onClick={exportToCSV}
                            className="px-2 py-1 bg-[#F4F5F7] hover:bg-[#EBECF0] text-[#172B4D] border border-[#DFE1E6] text-xs font-semibold rounded transition-colors flex items-center gap-1"
                            title="Export Backlog to CSV"
                        >
                            <Download className="w-3.5 h-3.5 text-[#5E6C84]" />
                            <span>Export CSV</span>
                        </button>

                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2 py-1 bg-[#F4F5F7] hover:bg-[#EBECF0] text-[#172B4D] border border-[#DFE1E6] text-xs font-semibold rounded transition-colors flex items-center gap-1"
                            title="Import Issues from CSV"
                        >
                            <Upload className="w-3.5 h-3.5 text-[#5E6C84]" />
                            <span>Import CSV</span>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleImportCSV}
                            className="hidden"
                        />

                        <button onClick={createSprint} className="px-3 py-1 bg-[#0052CC] hover:bg-[#0047B3] text-white text-xs font-bold rounded transition-colors flex items-center gap-1 shadow-xs ml-1">
                            <Plus className="w-3.5 h-3.5" />
                            New Sprint
                        </button>
                    </div>
                </div>

                {/* JIRA QUICK FILTERS BAR */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#DFE1E6]/60">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 text-[#5E6C84] absolute left-2.5 top-2" />
                        <input
                            type="text"
                            placeholder="Filter by summary or key..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[#FAFBFC] border border-[#DFE1E6] rounded px-2.5 pl-8 py-1 text-xs text-[#172B4D] outline-none focus:border-[#0052CC] focus:bg-white transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setOnlyMyIssues(!onlyMyIssues)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                onlyMyIssues ? 'bg-[#DEEBFF] text-[#0052CC] border-[#0052CC] font-bold' : 'bg-white text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                            }`}
                        >
                            Only My Issues
                        </button>

                        <button
                            onClick={() => setHighPriorityOnly(!highPriorityOnly)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                highPriorityOnly ? 'bg-[#FFEBE6] text-[#DE350B] border-[#DE350B] font-bold' : 'bg-white text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                            }`}
                        >
                            High Priority
                        </button>

                        <button
                            onClick={() => setUnassignedOnly(!unassignedOnly)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                unassignedOnly ? 'bg-[#EAE6FF] text-[#403294] border-[#403294] font-bold' : 'bg-white text-[#42526E] border-[#DFE1E6] hover:bg-[#EBECF0]'
                            }`}
                        >
                            Unassigned
                        </button>

                        {(onlyMyIssues || highPriorityOnly || unassignedOnly || searchQuery || assigneeFilter || epicFilter) && (
                            <button
                                onClick={() => {
                                    setOnlyMyIssues(false)
                                    setHighPriorityOnly(false)
                                    setUnassignedOnly(false)
                                    setSearchQuery('')
                                    setAssigneeFilter(null)
                                    setEpicFilter(null)
                                }}
                                className="text-xs text-[#0052CC] hover:underline px-2 font-medium"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN DUAL PANE SIDE-BY-SIDE CONTAINER */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* ── LEFT PANE: ROADMAP TIMELINE & EPICS (40% WIDTH) ── */}
                <div className="w-[42%] bg-[#FAFBFC] border-r border-[#DFE1E6] flex flex-col flex-shrink-0 overflow-hidden">
                    {/* Left Pane Header */}
                    <div className="px-4 py-3 bg-white border-b border-[#DFE1E6] flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#0052CC]" />
                            <h2 className="font-bold text-xs text-[#172B4D] uppercase tracking-wider">Sprint & Epic Roadmap</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleGenerateEpics} disabled={isGeneratingEpics} className="text-[11px] text-[#6554C0] font-semibold bg-[#EAE6FF] px-2 py-0.5 rounded hover:bg-[#6554C0] hover:text-white transition-colors flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> AI Epics
                            </button>
                            <button onClick={() => setCreatingEpic(true)} className="text-[11px] text-[#0052CC] font-semibold bg-[#DEEBFF] px-2 py-0.5 rounded hover:bg-[#0052CC] hover:text-white transition-colors">
                                + Epic
                            </button>
                        </div>
                    </div>

                    {/* Left Pane Scroll Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">

                        {/* Inline Create Epic Form */}
                        {creatingEpic && (
                            <div className="p-3 bg-white border border-[#0052CC] rounded-md space-y-2 shadow-xs">
                                <input
                                    autoFocus
                                    value={newEpicName}
                                    onChange={e => setNewEpicName(e.target.value)}
                                    placeholder="New Epic Title..."
                                    className="w-full border border-[#DFE1E6] rounded px-2.5 py-1 text-xs text-[#172B4D] outline-none focus:border-[#0052CC]"
                                />
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => setCreatingEpic(false)} className="text-xs text-[#5E6C84] hover:text-[#172B4D]">Cancel</button>
                                    <button onClick={createEpic} disabled={savingEpic || !newEpicName.trim()} className="text-xs bg-[#0052CC] text-white px-3 py-1 rounded font-semibold">Save</button>
                                </div>
                            </div>
                        )}

                        {/* GANTT TIMELINE CHART */}
                        <div className="bg-white border border-[#DFE1E6] rounded-lg overflow-hidden shadow-xs">
                            <div className="px-3 py-2 bg-[#FAFBFC] border-b border-[#DFE1E6] text-[11px] font-bold text-[#5E6C84] flex items-center justify-between">
                                <span>Gantt Schedule</span>
                                <span>{sprints.length} Sprints</span>
                            </div>

                            <div className="overflow-x-auto">
                                <div className="min-w-[480px] divide-y divide-[#DFE1E6]">
                                    {/* Header Row */}
                                    <div className="flex bg-[#FAFBFC] border-b border-[#DFE1E6] text-[9px] font-bold text-[#5E6C84]">
                                        <div className="w-36 p-1.5 border-r border-[#DFE1E6] sticky left-0 bg-[#FAFBFC] z-10 truncate">Item</div>
                                        <div className="flex-1 flex">
                                            {timelineDays.map((d, idx) => (
                                                <div key={idx} className="flex-1 text-center py-1 border-r border-[#DFE1E6]/40 min-w-[20px]">
                                                    {d.getDate()}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Sprint Rows */}
                                    {sprints.map(s => {
                                        const count = sprintIssueCount(s.id)
                                        const done = sprintDoneCount(s.id)
                                        const pct = count > 0 ? Math.round((done / count) * 100) : 0
                                        const sDateStr = getValidDateStr(s.start_date, 0)
                                        const eDateStr = getValidDateStr(s.end_date, 14)

                                        return (
                                            <div key={s.id} className="flex items-center text-xs">
                                                <div className="w-36 p-2 border-r border-[#DFE1E6] sticky left-0 bg-white z-10 space-y-0.5">
                                                    <div className="font-bold text-[11px] text-[#172B4D] truncate">{s.name}</div>
                                                    <div className="flex items-center gap-1 text-[9px] text-[#5E6C84]">
                                                        <input 
                                                            type="date" 
                                                            value={sDateStr} 
                                                            onChange={e => updateSprintDates(s.id, e.target.value, eDateStr)}
                                                            className="border rounded px-0.5 text-[9px] bg-white outline-none w-16" 
                                                        />
                                                        <span>→</span>
                                                        <input 
                                                            type="date" 
                                                            value={eDateStr} 
                                                            onChange={e => updateSprintDates(s.id, sDateStr, e.target.value)}
                                                            className="border rounded px-0.5 text-[9px] bg-white outline-none w-16" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex-1 p-1.5 relative flex items-center">
                                                    <div className="w-full bg-[#FAFBFC] border border-dashed border-[#DFE1E6] rounded h-6 relative overflow-hidden flex items-center px-2">
                                                        <div 
                                                            className={`h-full absolute left-0 top-0 rounded ${
                                                                s.status === 'active' ? 'bg-[#0052CC]' : 'bg-[#6554C0]'
                                                            }`} 
                                                            style={{ width: `${Math.max(5, pct)}%` }} 
                                                        />
                                                        <span className="relative z-10 text-[10px] font-bold text-white drop-shadow">
                                                            {pct}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* EPICS ACCORDION LIST */}
                        <div className="bg-white border border-[#DFE1E6] rounded-lg p-3 space-y-2 shadow-xs">
                            <div className="flex items-center justify-between text-xs font-bold text-[#172B4D]">
                                <span className="flex items-center gap-1.5">
                                    <Target className="w-4 h-4 text-[#6554C0]" />
                                    Project Epics ({epics.length})
                                </span>
                            </div>

                            {epics.length === 0 ? (
                                <div className="text-center py-4 text-xs text-[#5E6C84]">
                                    No epics created yet. Click <strong>+ Epic</strong> above.
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {epics.map(epic => {
                                        const count = issueCountByEpic(epic.id)
                                        const isSelected = epicFilter === epic.id
                                        return (
                                            <button
                                                key={epic.id}
                                                onClick={() => setEpicFilter(isSelected ? null : epic.id)}
                                                className={`w-full text-left p-2 rounded text-xs font-medium transition-all flex items-center justify-between ${
                                                    isSelected ? 'bg-[#EAE6FF] ring-1 ring-[#6554C0]' : 'bg-[#FAFBFC] hover:bg-[#EBECF0]'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: epic.color || '#6554C0' }} />
                                                    <span className="truncate text-[#172B4D] font-bold">{epic.name}</span>
                                                </div>
                                                <span className="text-[10px] font-bold bg-[#DFE1E6] px-1.5 py-0.5 rounded text-[#42526E]">
                                                    {count} issues
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT PANE: ACTIVE SPRINTS & BACKLOG DRAG-AND-DROP (58% WIDTH) ── */}
                <div className="flex-1 bg-white flex flex-col overflow-hidden min-w-0">
                    
                    {/* Right Pane Header & Filter Tabs */}
                    <div className="px-6 py-3 border-b border-[#DFE1E6] flex items-center justify-between flex-shrink-0 bg-white">
                        <div className="flex items-center gap-2">
                            <ListOrdered className="w-4 h-4 text-[#0052CC]" />
                            <h2 className="font-bold text-xs text-[#172B4D] uppercase tracking-wider">Sprints & Backlog Drag-and-Drop</h2>
                        </div>

                        {/* Filter Sprint Status Tabs */}
                        <div className="flex items-center bg-[#F4F5F7] p-0.5 rounded text-xs font-semibold">
                            <button
                                onClick={() => setSprintViewFilter('all')}
                                className={`px-2.5 py-1 rounded transition-colors ${sprintViewFilter === 'all' ? 'bg-white text-[#0052CC] shadow-xs' : 'text-[#5E6C84]'}`}
                            >
                                All ({sprints.length})
                            </button>
                            <button
                                onClick={() => setSprintViewFilter('active')}
                                className={`px-2.5 py-1 rounded transition-colors ${sprintViewFilter === 'active' ? 'bg-white text-[#0052CC] shadow-xs' : 'text-[#5E6C84]'}`}
                            >
                                Active Only
                            </button>
                            <button
                                onClick={() => setSprintViewFilter('planned')}
                                className={`px-2.5 py-1 rounded transition-colors ${sprintViewFilter === 'planned' ? 'bg-white text-[#0052CC] shadow-xs' : 'text-[#5E6C84]'}`}
                            >
                                Planned Only
                            </button>
                        </div>
                    </div>

                    {/* Right Pane Scroll Container */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <DragDropContext onDragEnd={onDragEnd}>
                            <div className="space-y-6">

                                {/* Sprints List */}
                                {filteredSprints.map(sprint => {
                                    const sprintIssues = filtered.filter(i => (i.data as any).sprint_id === sprint.id)
                                    const totalCount = sprintIssueCount(sprint.id)
                                    const doneCount = sprintDoneCount(sprint.id)
                                    const pts = sprintPoints(sprint.id)
                                    const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
                                    const isActive = sprint.status === 'active'
                                    const isDone = sprint.status === 'completed'
                                    const isCompleting = completingSprintId === sprint.id

                                    return (
                                        <div 
                                            key={sprint.id}
                                            className={`rounded-lg border-2 overflow-hidden transition-all ${
                                                isActive ? 'border-[#0052CC]' : isDone ? 'border-[#00875A]/40' : 'border-[#DFE1E6]'
                                            }`}
                                        >
                                            {/* Sprint Card Header */}
                                            <div className={`px-4 py-3 flex items-center justify-between gap-3 ${
                                                isActive ? 'bg-[#DEEBFF]/40' : isDone ? 'bg-[#E3FCEF]/30' : 'bg-[#F4F5F7]'
                                            }`}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Zap className={`w-4 h-4 ${isActive ? 'text-[#0052CC]' : 'text-[#5E6C84]'}`} />
                                                    <h3 className="font-bold text-sm text-[#172B4D] truncate">{sprint.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                        isActive ? 'bg-[#0052CC] text-white' : isDone ? 'bg-[#00875A] text-white' : 'bg-[#DFE1E6] text-[#42526E]'
                                                    }`}>
                                                        {sprint.status || 'planned'} ({progress}%)
                                                    </span>
                                                    <span className="text-xs text-[#5E6C84]">({totalCount} items · {pts} pts)</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {!isActive && !isDone && (
                                                        <>
                                                            <button onClick={() => handleAutoPlan(sprint.id)} disabled={isPlanning}
                                                                className="px-2 py-1 text-[11px] font-semibold bg-[#EAE6FF] text-[#403294] hover:bg-[#403294] hover:text-white rounded transition-colors flex items-center gap-1">
                                                                <Sparkles className="w-3 h-3" /> Auto-plan
                                                            </button>
                                                            <button onClick={() => startSprint(sprint.id)}
                                                                className="px-3 py-1 text-xs font-bold bg-[#0052CC] hover:bg-[#0047B3] text-white rounded transition-colors">
                                                                Start Sprint
                                                            </button>
                                                        </>
                                                    )}

                                                    {isActive && (
                                                        <button onClick={() => setCompletingSprintId(isCompleting ? null : sprint.id)}
                                                            className="px-3 py-1 text-xs font-bold bg-[#00875A] hover:bg-[#006644] text-white rounded transition-colors">
                                                            Complete Sprint
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sprint Complete Modal Banner */}
                                            {isCompleting && (
                                                <div className="p-3 bg-[#FFF0B3] border-b border-[#DFE1E6] text-xs text-[#172B4D] space-y-2">
                                                    <div className="font-bold">Complete {sprint.name}?</div>
                                                    <p>{totalCount - doneCount > 0 ? `${totalCount - doneCount} unfinished item(s) will move back to Backlog.` : 'All tasks completed!'}</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => completeSprint(sprint.id)} className="px-3 py-1 bg-[#00875A] text-white font-bold rounded text-xs">Confirm</button>
                                                        <button onClick={() => setCompletingSprintId(null)} className="px-3 py-1 bg-white text-[#5E6C84] border rounded text-xs">Cancel</button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Droppable Area for Sprint */}
                                            <Droppable droppableId={sprint.id}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.droppableProps}
                                                        className={`p-2 min-h-[50px] transition-colors ${snapshot.isDraggingOver ? 'bg-[#DEEBFF]/30' : 'bg-white'}`}>
                                                        {sprintIssues.length === 0 ? (
                                                            <div className="py-4 text-center text-xs text-[#A5ADBA] border border-dashed border-[#DFE1E6] rounded">
                                                                Drag backlog items here to plan them into {sprint.name}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1">
                                                                {sprintIssues.map((item, index) => (
                                                                    <IssueRow key={item.id} item={item} index={index} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    )
                                })}

                                {/* UNPLANNED BACKLOG CONTAINER */}
                                <div className="rounded-lg border-2 border-[#DFE1E6] overflow-hidden bg-white">
                                    <div className="px-4 py-3 bg-[#F4F5F7] border-b border-[#DFE1E6] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ListOrdered className="w-4 h-4 text-[#5E6C84]" />
                                            <h3 className="font-bold text-xs text-[#172B4D] uppercase tracking-wider">Unplanned Backlog</h3>
                                            <span className="text-xs font-semibold text-[#5E6C84]">({backlogIssues.length} items)</span>
                                        </div>
                                        <span className="text-xs text-[#5E6C84]">Drag items up into a sprint ↑</span>
                                    </div>

                                    <Droppable droppableId="backlog">
                                        {(provided, snapshot) => (
                                            <div ref={provided.innerRef} {...provided.droppableProps}
                                                className={`p-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-[#DEEBFF]/30' : 'bg-white'}`}>
                                                {backlogIssues.length === 0 ? (
                                                    <div className="py-8 text-center text-xs text-[#A5ADBA]">
                                                        No unplanned backlog issues. Use <strong>+ Create</strong> in topbar!
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {backlogIssues.map((item, index) => (
                                                            <IssueRow key={item.id} item={item} index={index} />
                                                        ))}
                                                    </div>
                                                )}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            </div>
                        </DragDropContext>
                    </div>
                </div>
            </div>

            {automationModalOpen && id && (
                <ProjectAutomationModal
                    isOpen={automationModalOpen}
                    onClose={() => setAutomationModalOpen(false)}
                    projectId={id}
                />
            )}

            {selectedTaskId && id && (
                <TaskDetailsModal
                    taskId={selectedTaskId}
                    projectId={id}
                    onClose={() => setSelectedTaskId(null)}
                    onUpdate={loadData}
                />
            )}

            {selectedBugId && id && (
                <BugDetailsModal
                    bugId={selectedBugId}
                    projectId={id}
                    onClose={() => setSelectedBugId(null)}
                    onUpdate={loadData}
                />
            )}
        </div>
    )
}
