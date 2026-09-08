import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { TaskCard, type Task } from '../components/projects/tasks/TaskCard'
import { BugCard, type Bug } from '../components/projects/BugCard'
import { Loader2, Zap, Sparkles } from 'lucide-react'
import { aiClient } from '@/lib/ai-client'

type Issue = 
    | { type: 'task', id: string, data: Task }
    | { type: 'bug', id: string, data: Bug }

export function BacklogPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [project, setProject] = useState<any>(null)
    const [issues, setIssues] = useState<Issue[]>([])
    const [sprints, setSprints] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isPlanning, setIsPlanning] = useState(false)
    const [isGeneratingEpics, setIsGeneratingEpics] = useState(false)
    const [members, setMembers] = useState<any[]>([])
    const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [id])

    async function loadData() {
        if (!id) return
        setLoading(true)

        supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => setProject(data))

        const { data: sprintsData } = await supabase.from('sprints').select('*').eq('project_id', id).order('created_at', { ascending: false })
        if (sprintsData) setSprints(sprintsData)

        // Fetch epics safely (might not exist if user didn't run migration)
        const { data: epicsData } = await supabase.from('epics').select('*').eq('project_id', id).order('created_at', { ascending: false }).catch(() => ({ data: [] }))
        if (epicsData) setEpics(epicsData)

        const { data: membersData } = await supabase
            .from('project_members')
            .select(`profiles (id, display_name, avatar_url)`)
            .eq('project_id', id)

        if (membersData) {
            setMembers(membersData.map((m: any) => m.profiles))
        }

        try {
            const [tasksRes, bugsRes] = await Promise.all([
                supabase.from('tasks').select('*, assignee:profiles!tasks_assigned_to_fkey(display_name, avatar_url), epic:epics(name), resolved_at').eq('project_id', id).then(r => r).catch(() => ({ data: [], error: null })),
                supabase.from('bugs').select('*, assignee:profiles!bugs_assigned_to_fkey(display_name, avatar_url), epic:epics(name), resolved_at').eq('project_id', id).then(r => r).catch(() => ({ data: [], error: null }))
            ])

            const combined: Issue[] = []
            if (tasksRes.data) {
                combined.push(...tasksRes.data.map((t: any) => ({ type: 'task' as const, id: `task-${t.id}`, data: t })))
            }
            if (bugsRes.data) {
                combined.push(...bugsRes.data.map((b: any) => ({ type: 'bug' as const, id: `bug-${b.id}`, data: b })))
            }

            setIssues(combined)
        } catch (e) {
            console.error("Error loading backlog issues", e)
        } finally {
            setLoading(false)
        }
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        const newSprintId = destination.droppableId === 'backlog' ? null : destination.droppableId

        // Optimistic update
        const updatedIssues = [...issues]
        const sourceIndex = updatedIssues.findIndex(i => i.id === draggableId)
        if (sourceIndex === -1) return

        updatedIssues[sourceIndex] = {
            ...updatedIssues[sourceIndex],
            data: { ...updatedIssues[sourceIndex].data, sprint_id: newSprintId }
        }
        setIssues(updatedIssues)

        const isTask = draggableId.startsWith('task-')
        const table = isTask ? 'tasks' : 'bugs'
        const rawId = draggableId.replace(isTask ? 'task-' : 'bug-', '')

        // We wrap in try-catch in case sprint_id doesn't exist on bugs table yet
        try {
            await supabase.from(table).update({ sprint_id: newSprintId }).eq('id', rawId)
        } catch (e) {
            console.error("Migration missing for bugs.sprint_id")
        }
    }

    async function createSprint() {
        if (!id) return
        await supabase.from('sprints').insert({ project_id: id, name: `Sprint ${sprints.length + 1}` })
        loadData()
    }

    async function startSprint(sprintId: string) {
        await supabase.from('sprints').update({ status: 'active' }).eq('id', sprintId)
        loadData()
    }

    async function completeSprint(sprintId: string) {
        await supabase.from('sprints').update({ status: 'completed' }).eq('id', sprintId)
        loadData()
    }

    async function handleAutoPlan(sprintId: string) {
        setIsPlanning(true)
        try {
            // Mock AI behavior for demonstration
            // Take up to 5 top priority backlog items and assign them to sprint
            const backlog = issues.filter(i => !(i.data as any).sprint_id)
            const toPlan = backlog.slice(0, 5)
            
            for (const issue of toPlan) {
                const isTask = issue.type === 'task'
                const table = isTask ? 'tasks' : 'bugs'
                await supabase.from(table).update({ sprint_id: sprintId }).eq('id', issue.data.id).catch(() => {})
            }
            await loadData()
        } finally {
            setIsPlanning(false)
        }
    }

    async function handleGenerateEpics() {
        setIsGeneratingEpics(true)
        try {
            // Mock AI behavior to generate epics based on backlog items
            const epicsToCreate = [
                { project_id: id, name: 'Authentication Overhaul', description: 'Generated by AI based on backlog items.' },
                { project_id: id, name: 'Performance Improvements', description: 'Generated by AI based on backlog items.' }
            ]
            
            await supabase.from('epics').insert(epicsToCreate).catch(() => {})
            await loadData()
        } finally {
            setIsGeneratingEpics(false)
        }
    }

    if (!project) return null

    const filteredIssues = assigneeFilter ? issues.filter(i => i.data.assigned_to === assigneeFilter) : issues
    const backlogIssues = filteredIssues.filter(i => !(i.data as any).sprint_id)

    return (
        <div className="flex flex-col flex-1 min-h-0 w-full bg-white overflow-y-auto">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex-shrink-0">
                <div className="flex items-center text-sm text-[#5E6C84] mb-2">
                    <Link to="/projects" className="hover:underline">Projects</Link>
                    <span className="mx-2">/</span>
                    <Link to={`/projects/${id}`} className="hover:underline">{project.name}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-[#172B4D]">Backlog</span>
                </div>
                
                <div className="flex justify-between items-end">
                    <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">
                        Backlog
                    </h1>
                </div>

                <div className="mt-6 flex items-center gap-4">
                    <span className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Quick Filters</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setAssigneeFilter(null)}
                            className={`px-3 py-1.5 rounded-[3px] text-sm font-medium transition-colors ${!assigneeFilter ? 'bg-[#DEEBFF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                        >
                            All
                        </button>
                        <div className="w-px h-4 bg-[#DFE1E6] mx-2"></div>
                        {members.map(member => (
                            <button
                                key={member.id}
                                onClick={() => setAssigneeFilter(assigneeFilter === member.id ? null : member.id)}
                                className={`p-1 rounded-full transition-all ${assigneeFilter === member.id ? 'ring-2 ring-[#0052CC] ring-offset-1' : 'hover:opacity-80'}`}
                                title={member.display_name}
                            >
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} className="w-7 h-7 rounded-full" alt={member.display_name} />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold">
                                        {member.display_name?.charAt(0)}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 max-w-[1400px] w-full px-8 pb-12 gap-8">
                {/* Epics Sidebar */}
                <div className="w-[280px] flex-shrink-0 flex flex-col gap-4">
                    <div className="bg-[#FAFBFC] border border-[#DFE1E6] rounded p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-[14px] text-[#172B4D] uppercase tracking-wider">Epics</h2>
                            <button 
                                onClick={handleGenerateEpics}
                                disabled={isGeneratingEpics}
                                className="p-1.5 text-[#403294] bg-[#EAE6FF] hover:bg-[#403294] hover:text-white rounded transition-colors flex items-center justify-center shadow-sm"
                                title="Auto-Generate Epics with AI"
                            >
                                {isGeneratingEpics ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            </button>
                        </div>
                        {epics.length === 0 ? (
                            <div className="text-[13px] text-[#5E6C84] p-3 border border-dashed border-[#DFE1E6] rounded bg-white text-center">
                                No epics found. Click the AI button to auto-generate epics from your backlog.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {epics.map(epic => (
                                    <div key={epic.id} className="p-2.5 bg-white border border-[#DFE1E6] rounded-[3px] shadow-[0_1px_2px_rgba(9,30,66,0.15)] text-[13px] font-medium text-[#172B4D] cursor-pointer hover:bg-[#EBECF0] transition-colors flex items-center gap-2">
                                        <div className="w-3 h-3 rounded bg-[#6554C0] flex-shrink-0"></div>
                                        <span className="truncate">{epic.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sprints and Backlog */}
                <div className="flex-1 min-w-0">
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="space-y-6">
                            {/* Sprints Container */}
                            {sprints.map(sprint => {
                                const sprintIssues = filteredIssues.filter(i => (i.data as any).sprint_id === sprint.id)
                                return (
                                    <div key={sprint.id} className="bg-[#F4F5F7] rounded flex flex-col">
                                        <div className="px-4 py-3 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <h2 className="font-semibold text-[14px] text-[#172B4D]">{sprint.name}</h2>
                                                <span className="text-[12px] text-[#5E6C84]">{sprintIssues.length} issues</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                                    sprint.status === 'active' ? 'bg-[#DEEBFF] text-[#0052CC]' :
                                                    sprint.status === 'completed' ? 'bg-[#E3FCEF] text-[#006644]' :
                                                    'bg-[#DFE1E6] text-[#42526E]'
                                                }`}>
                                                    {sprint.status}
                                                </span>
                                                {sprint.status === 'planned' && (
                                                    <>
                                                        <button 
                                                            onClick={() => handleAutoPlan(sprint.id)}
                                                            disabled={isPlanning}
                                                            className="text-sm bg-[#EAE6FF] hover:bg-[#403294] hover:text-white text-[#403294] px-3 py-1 rounded-[3px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                                            title="Auto-Plan Sprint with AI"
                                                        >
                                                            {isPlanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                            Auto-Plan
                                                        </button>
                                                        <button onClick={() => startSprint(sprint.id)} className="text-sm bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-3 py-1 rounded font-medium transition-colors border border-[#DFE1E6]">
                                                            Start sprint
                                                        </button>
                                                    </>
                                                )}
                                                {sprint.status === 'active' && (
                                                    <button onClick={() => completeSprint(sprint.id)} className="text-sm bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-3 py-1 rounded font-medium transition-colors border border-[#DFE1E6]">
                                                        Complete sprint
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <Droppable droppableId={sprint.id}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`p-2 min-h-[40px] transition-colors ${snapshot.isDraggingOver ? 'bg-[#EBECF0]' : ''}`}
                                                >
                                                    {sprintIssues.map((issue, index) => (
                                                        <div key={issue.id} className="mb-1">
                                                            {issue.type === 'task' ? (
                                                                <TaskCard task={issue.data as Task} index={index} onClick={() => {}} />
                                                            ) : (
                                                                <BugCard bug={issue.data as Bug} index={index} onClick={() => {}} />
                                                            )}
                                                        </div>
                                                    ))}
                                                    {provided.placeholder}
                                                    {sprintIssues.length === 0 && !snapshot.isDraggingOver && (
                                                        <div className="flex items-center justify-center h-10 text-[#5E6C84] text-[13px] border border-dashed border-[#DFE1E6] rounded bg-white m-2">
                                                            Plan a sprint by dragging issues here
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                )
                            })}

                            {/* Backlog Container */}
                            <div className="bg-white border border-[#DFE1E6] rounded flex flex-col">
                                <div className="px-4 py-3 border-b border-[#DFE1E6] flex justify-between items-center bg-[#FAFBFC]">
                                    <div className="flex items-center gap-3">
                                        <h2 className="font-semibold text-[14px] text-[#172B4D]">Backlog</h2>
                                        <span className="text-[12px] text-[#5E6C84]">{backlogIssues.length} issues</span>
                                    </div>
                                    <button
                                        onClick={createSprint}
                                        className="text-sm bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#172B4D] px-3 py-1 rounded font-medium transition-colors border border-[#DFE1E6]"
                                    >
                                        Create sprint
                                    </button>
                                </div>
                                <Droppable droppableId="backlog">
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`p-2 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-[#EBECF0]' : ''}`}
                                        >
                                            {backlogIssues.map((issue, index) => (
                                                <div key={issue.id} className="mb-1">
                                                    {issue.type === 'task' ? (
                                                        <TaskCard task={issue.data as Task} index={index} onClick={() => {}} />
                                                    ) : (
                                                        <BugCard bug={issue.data as Bug} index={index} onClick={() => {}} />
                                                    )}
                                                </div>
                                            ))}
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
    )
}
