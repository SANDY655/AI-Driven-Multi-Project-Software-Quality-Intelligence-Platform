import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { Bug } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type Bug as BugType, BugCard } from './BugCard'
import { useNavigate } from 'react-router-dom'

interface KanbanBoardProps {
    projectId: string
    refreshTrigger?: number
    userRole?: string
}

const COLUMNS = [
    { id: 'open', title: 'To Do', color: 'bg-pink-100', dot: 'bg-pink-400', text: 'text-zinc-800' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-orange-100', dot: 'bg-orange-400', text: 'text-zinc-800' },
    { id: 'in_review', title: 'In Review', color: 'bg-cyan-100', dot: 'bg-cyan-400', text: 'text-zinc-800' },
    { id: 'resolved', title: 'Resolved', color: 'bg-purple-100', dot: 'bg-purple-400', text: 'text-zinc-800' },
    { id: 'closed', title: 'Completed', color: 'bg-green-100', dot: 'bg-green-400', text: 'text-zinc-800' },
]

export function KanbanBoard({ projectId, refreshTrigger = 0, userRole }: KanbanBoardProps) {
    const [bugs, setBugs] = useState<BugType[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        loadBugs()

        // Subscription for real-time updates
        const subscription = supabase
            .channel(`public:bugs:project_id=eq.${projectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bugs', filter: `project_id=eq.${projectId}` }, _payload => {
                loadBugs() // Reload full data to get assignees joined, etc. For production we can apply payload directly.
            })
            .subscribe()

        return () => {
            supabase.removeChannel(subscription)
        }
    }, [projectId, refreshTrigger])

    async function loadBugs() {
        const { data, error } = await supabase
            .from('bugs')
            .select(`
                *,
                assignee:profiles!bugs_assigned_to_fkey (
                    display_name,
                    avatar_url
                )
            `)
            .eq('project_id', projectId)
            .order('priority', { ascending: true }) // primary sort
            .order('created_at', { ascending: false }) // secondary sort

        if (!error && data) {
            setBugs(data)
        } else if (error) {
            console.error('Error loading bugs:', error)
        }
        setLoading(false)
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        // RBAC: Only admin, pm, tester, and developer can move bugs
        if (!userRole || userRole === 'viewer') {
            console.warn('Viewers cannot update bug status')
            return
        }

        const draggedBug = bugs.find(b => b.id === draggableId)
        if (!draggedBug) return

        const newStatus = destination.droppableId

        // Optimistic update
        const updatedBugs = [...bugs]
        const sourceIndex = updatedBugs.findIndex(b => b.id === draggableId)
        updatedBugs[sourceIndex].status = newStatus
        setBugs(updatedBugs)

        // Persist
        const { error } = await supabase
            .from('bugs')
            .update({ status: newStatus })
            .eq('id', draggableId)

        if (error) {
            console.error('Error updating bug status:', error)
            // Revert on error
            loadBugs()
        }
    }

    const getBugsByStatus = (status: string) => bugs.filter(b => b.status === status)

    if (loading) {
        return (
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-8 flex items-center justify-center h-full m-6">
                <div className="animate-pulse flex flex-col items-center">
                    <Bug className="h-8 w-8 text-zinc-300 mb-4" />
                    <div className="h-4 w-32 bg-zinc-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-x-auto p-8 flex gap-6 bg-zinc-50/50 items-stretch min-h-0">
            <DragDropContext onDragEnd={onDragEnd}>
                {COLUMNS.map(column => {
                    const columnBugs = getBugsByStatus(column.id)

                    return (
                        <div key={column.id} className={`flex-shrink-0 w-80 flex flex-col ${column.color} rounded-[32px] h-full pb-2 shadow-sm`}>
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
                                        {columnBugs.map((bug, index) => (
                                            <div key={bug.id} className="">
                                                <BugCard
                                                    bug={bug}
                                                    index={index}
                                                    onClick={(b) => navigate(`/projects/${projectId}/bugs/${b.id}`)}
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
        </div>
    )
}
