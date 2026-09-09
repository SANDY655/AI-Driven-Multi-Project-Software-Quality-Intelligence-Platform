import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { type Task as TaskType, TaskCard } from './TaskCard'
import { type Bug as BugType, BugCard } from '../BugCard'
import { TaskDetailsModal } from './TaskDetailsModal'
import { BugDetailsModal } from '../BugDetailsModal'
import { JiraQuickFiltersBar, type QuickFilterState, filterItems } from '../JiraQuickFiltersBar'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ActiveSprintBoardProps {
    projectId: string
    refreshTrigger?: number
    userRole?: string
    sprintId?: string | null
}

type Issue = 
    | { type: 'task', id: string, data: TaskType }
    | { type: 'bug', id: string, data: BugType }

export function TaskKanbanBoard({ projectId, refreshTrigger = 0, userRole, sprintId }: ActiveSprintBoardProps) {
    const { user } = useAuth()
    const [issues, setIssues] = useState<Issue[]>([])
    const [columns, setColumns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [selectedBugId, setSelectedBugId] = useState<string | null>(null)
    const [quickFilters, setQuickFilters] = useState<QuickFilterState>({
        searchQuery: '',
        onlyMyIssues: false,
        highPriorityOnly: false,
        unassignedOnly: false,
        bugsOnly: false,
        tasksOnly: false,
        recentlyUpdated: false
    })

    useEffect(() => {
        async function init() {
            await loadColumns()
            await loadIssues()
        }
        init()

        // We only subscribe to tasks for now, complex multi-subscriptions can be added later
        const subscription = supabase
            .channel(`public:issues:project_id=eq.${projectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, _payload => {
                loadIssues()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bugs', filter: `project_id=eq.${projectId}` }, _payload => {
                loadIssues()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [projectId, refreshTrigger, sprintId])

    async function loadColumns() {
        const { data } = await supabase
            .from('project_statuses')
            .select('*')
            .eq('project_id', projectId)
            .order('position', { ascending: true })

        if (data && data.length > 0) {
            setColumns(data)
        } else {
            setColumns([
                { id: '1', name: 'todo' },
                { id: '2', name: 'in_progress' },
                { id: '3', name: 'in_review' },
                { id: '4', name: 'done' }
            ])
        }
    }

    async function loadIssues() {
        if (sprintId === 'NO_ACTIVE_SPRINT') {
            setIssues([])
            setLoading(false)
            return
        }

        let tasksQuery = supabase
            .from('tasks')
            .select(`*, assignee:profiles!tasks_assigned_to_fkey(display_name, avatar_url), epic:epics(name), resolved_at`)
            .eq('project_id', projectId)

        let bugsQuery = supabase
            .from('bugs')
            .select(`*, assignee:profiles!bugs_assigned_to_fkey(display_name, avatar_url), epic:epics(name), resolved_at`)
            .eq('project_id', projectId)

        if (sprintId !== undefined) {
            if (sprintId === null) {
                tasksQuery = tasksQuery.is('sprint_id', null)
                // If migration hasn't run, this might fail for bugs. We catch it.
                bugsQuery = bugsQuery.is('sprint_id', null)
            } else {
                tasksQuery = tasksQuery.eq('sprint_id', sprintId)
                bugsQuery = bugsQuery.eq('sprint_id', sprintId)
            }
        }

        try {
            const [tasksRes, bugsRes] = await Promise.all([
                tasksQuery.order('created_at', { ascending: false }),
                bugsQuery.order('created_at', { ascending: false })
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
            console.error("Failed to load issues", e)
        } finally {
            setLoading(false)
        }
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        if (!userRole || userRole === 'viewer') {
            console.warn('Viewers cannot update task status')
            return
        }

        const draggedIssue = issues.find(i => i.id === draggableId)
        if (!draggedIssue) return

        const newStatus = destination.droppableId

        // Optimistic update
        const updatedIssues = [...issues]
        const sourceIndex = updatedIssues.findIndex(i => i.id === draggableId)
        const issue = updatedIssues[sourceIndex]
        if (issue.type === 'task') {
            updatedIssues[sourceIndex] = { ...issue, data: { ...issue.data, status: newStatus } }
        } else {
            updatedIssues[sourceIndex] = { ...issue, data: { ...issue.data, status: newStatus } }
        }
        setIssues(updatedIssues)

        const isTask = draggableId.startsWith('task-')
        const table = isTask ? 'tasks' : 'bugs'
        const rawId = draggableId.replace(isTask ? 'task-' : 'bug-', '')

        const { error } = await supabase
            .from(table)
            .update({ status: newStatus })
            .eq('id', rawId)

        if (error) {
            console.error('Error updating issue status:', error)
            loadIssues()
        }
    }

    const getFilteredIssues = () => {
        const rawItems = issues.map(i => i.data)
        const filteredData = filterItems(rawItems, quickFilters, user?.id)
        const filteredIds = new Set(filteredData.map(d => (d as any).id))
        return issues.filter(i => filteredIds.has(i.id))
    }

    const getIssuesByStatus = (status: string) => getFilteredIssues().filter(i => {
        // Handle custom mapping if bugs use different statuses like 'open', 'resolved'
        if (i.type === 'bug') {
            const bugStatus = i.data.status
            if (status === 'todo' && bugStatus === 'open') return true
            if (status === 'in_progress' && bugStatus === 'in_progress') return true
            if (status === 'in_review' && bugStatus === 'in_review') return true
            if (status === 'done' && (bugStatus === 'resolved' || bugStatus === 'closed')) return true
        }
        return i.data.status === status
    })

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            <div className="px-8 pt-4 pb-2 border-b border-[#DFE1E6] flex-shrink-0">
                <JiraQuickFiltersBar
                    currentUserId={user?.id}
                    filters={quickFilters}
                    onFiltersChange={setQuickFilters}
                    totalCount={issues.length}
                    filteredCount={getFilteredIssues().length}
                />
            </div>
            
            <div className="flex-1 overflow-x-auto p-8 flex gap-4 items-start min-h-0">
                <DragDropContext onDragEnd={onDragEnd}>
                    {columns.map(column => {
                        const columnIssues = getIssuesByStatus(column.name)
                        const title = column.name.split('_').map((w: string) => w.toUpperCase()).join(' ')

                    return (
                        <div key={column.name} className="flex-shrink-0 w-[280px] flex flex-col bg-[#F4F5F7] rounded-[3px] max-h-full">
                            <div className="px-3 py-3 flex justify-between items-center cursor-pointer">
                                <h3 className="font-semibold text-xs text-[#5E6C84] tracking-wider">{title} <span className="ml-1 text-[#5E6C84] font-normal">{columnIssues.length}</span></h3>
                            </div>

                            <Droppable droppableId={column.name}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 px-2 pb-2 overflow-y-auto space-y-2 min-h-[150px] ${snapshot.isDraggingOver ? 'bg-[#EBECF0]' : ''}`}
                                    >
                                        {columnIssues.map((issue, index) => (
                                            <div key={issue.id} className="mb-1">
                                                {issue.type === 'task' ? (
                                                    <TaskCard
                                                        task={issue.data as TaskType}
                                                        index={index}
                                                        onClick={(t) => setSelectedTaskId(t.id)}
                                                    />
                                                ) : (
                                                    <BugCard
                                                        bug={issue.data as BugType}
                                                        index={index}
                                                        onClick={(b) => setSelectedBugId(b.id)}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    )
                })}
            </DragDropContext>
            
            <TaskDetailsModal
                taskId={selectedTaskId}
                projectId={projectId}
                userRole={userRole}
                onClose={() => setSelectedTaskId(null)}
                onUpdate={loadIssues}
            />

                <BugDetailsModal
                    bugId={selectedBugId}
                    projectId={projectId}
                    userRole={userRole}
                    onClose={() => setSelectedBugId(null)}
                    onUpdate={loadIssues}
                />
            </div>
        </div>
    )
}
