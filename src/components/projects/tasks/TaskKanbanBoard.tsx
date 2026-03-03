import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { CheckSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type Task as TaskType, TaskCard } from './TaskCard'
import { TaskDetailsModal } from './TaskDetailsModal'

interface TaskKanbanBoardProps {
    projectId: string
    refreshTrigger?: number
    userRole?: string
}

const COLUMNS = [
    { id: 'todo', title: 'To Do', color: 'bg-zinc-100', dot: 'bg-zinc-400', text: 'text-zinc-800' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100', dot: 'bg-blue-400', text: 'text-zinc-800' },
    { id: 'in_review', title: 'In Review', color: 'bg-amber-100', dot: 'bg-amber-400', text: 'text-zinc-800' },
    { id: 'done', title: 'Done', color: 'bg-emerald-100', dot: 'bg-emerald-400', text: 'text-zinc-800' },
]

export function TaskKanbanBoard({ projectId, refreshTrigger = 0, userRole }: TaskKanbanBoardProps) {
    const [tasks, setTasks] = useState<TaskType[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

    useEffect(() => {
        loadTasks()

        // Subscription for real-time updates
        const subscription = supabase
            .channel(`public:tasks:project_id=eq.${projectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` }, _payload => {
                loadTasks() // Reload full data to get assignees joined, etc. For production we can apply payload directly.
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [projectId, refreshTrigger])

    async function loadTasks() {
        const { data, error } = await supabase
            .from('tasks')
            .select(`
                *,
                assignee:profiles!tasks_assigned_to_fkey (
                    display_name,
                    avatar_url
                )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false }) // primary sort

        if (!error && data) {
            setTasks(data)
        } else if (error) {
            console.error('Error loading tasks:', error)
        }
        setLoading(false)
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        // RBAC: Only admin, pm, tester, and developer can move tasks
        if (!userRole || userRole === 'viewer') {
            console.warn('Viewers cannot update task status')
            return
        }

        const draggedTask = tasks.find(b => b.id === draggableId)
        if (!draggedTask) return

        const newStatus = destination.droppableId

        // Optimistic update
        const updatedTasks = [...tasks]
        const sourceIndex = updatedTasks.findIndex(b => b.id === draggableId)
        updatedTasks[sourceIndex].status = newStatus
        setTasks(updatedTasks)

        // Persist
        const { error } = await supabase
            .from('tasks')
            .update({ status: newStatus })
            .eq('id', draggableId)

        if (error) {
            console.error('Error updating task status:', error)
            // Revert on error
            loadTasks()
        }
    }

    const getTasksByStatus = (status: string) => tasks.filter(b => b.status === status)

    if (loading) {
        return (
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 flex items-center justify-center h-full m-6">
                <div className="animate-pulse flex flex-col items-center">
                    <CheckSquare className="h-8 w-8 text-zinc-300 mb-4" />
                    <div className="h-4 w-32 bg-zinc-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-x-auto p-8 flex gap-6 bg-zinc-50/50 items-stretch min-h-0">
            <DragDropContext onDragEnd={onDragEnd}>
                {COLUMNS.map(column => {
                    const columnTasks = getTasksByStatus(column.id)

                    return (
                        <div key={column.id} className={`flex-shrink-0 w-80 flex flex-col ${column.color} rounded-[32px] max-h-full pb-2 shadow-sm`}>
                            <div className="px-6 py-5 flex justify-between items-center rounded-t-[32px]">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${column.dot}`}></div>
                                    <h3 className={`font-semibold text-[15px] ${column.text}`}>{column.title}</h3>
                                </div>
                                <span className={`text-[11px] font-semibold text-zinc-400 bg-white/50 px-0 opacity-0 group-hover:opacity-100 cursor-pointer`}>
                                    •••
                                </span>
                            </div>

                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 px-4 overflow-y-auto space-y-4 transition-colors min-h-[150px] ${snapshot.isDraggingOver ? 'bg-black/5 rounded-2xl mx-2' : ''
                                            }`}
                                    >
                                        {columnTasks.map((task, index) => (
                                            <div key={task.id} className="">
                                                <TaskCard
                                                    task={task}
                                                    index={index}
                                                    onClick={(b) => setSelectedTaskId(b.id)}
                                                    columnColor={column.color}
                                                />
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
                onUpdate={loadTasks}
            />
        </div>
    )
}
