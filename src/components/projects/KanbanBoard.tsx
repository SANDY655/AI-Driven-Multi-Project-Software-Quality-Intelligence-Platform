import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, type DropResult } from '@hello-pangea/dnd'
import { supabase } from '@/lib/supabase'
import { type Bug as BugType, BugCard } from './BugCard'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

interface KanbanBoardProps {
    projectId: string
    refreshTrigger?: number
    userRole?: string
    assigneeFilter?: string | null
}

const COLUMNS = [
    { id: 'open', title: 'TO DO' },
    { id: 'in_progress', title: 'IN PROGRESS' },
    { id: 'in_review', title: 'IN REVIEW' },
    { id: 'resolved', title: 'RESOLVED' },
    { id: 'closed', title: 'DONE' },
]

export function KanbanBoard({ projectId, refreshTrigger = 0, userRole, assigneeFilter }: KanbanBoardProps) {
    const [bugs, setBugs] = useState<BugType[]>([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        loadBugs()

        const subscription = supabase
            .channel(`public:bugs:project_id=eq.${projectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bugs', filter: `project_id=eq.${projectId}` }, _payload => {
                loadBugs()
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
            .order('priority', { ascending: true }) 
            .order('created_at', { ascending: false })

        if (!error && data) {
            setBugs(data)
        }
        setLoading(false)
    }

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

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

        const { error } = await supabase
            .from('bugs')
            .update({ status: newStatus })
            .eq('id', draggableId)

        if (error) {
            console.error('Error updating bug status:', error)
            loadBugs()
        }
    }

    const getBugsByStatus = (status: string) => {
        const statusBugs = bugs.filter(b => b.status === status)
        if (!assigneeFilter) return statusBugs
        return statusBugs.filter(b => b.assigned_to === assigneeFilter)
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#0052CC]" />
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-x-auto p-8 flex gap-4 bg-white items-start min-h-0">
            <DragDropContext onDragEnd={onDragEnd}>
                {COLUMNS.map(column => {
                    const columnBugs = getBugsByStatus(column.id)

                    return (
                        <div key={column.id} className="flex-shrink-0 w-[280px] flex flex-col bg-[#F4F5F7] rounded-[3px] max-h-full">
                            <div className="px-3 py-3 flex justify-between items-center cursor-pointer">
                                <h3 className="font-semibold text-xs text-[#5E6C84] tracking-wider">{column.title} <span className="ml-1 text-[#5E6C84] font-normal">{columnBugs.length}</span></h3>
                            </div>

                            <Droppable droppableId={column.id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 px-2 pb-2 overflow-y-auto space-y-2 min-h-[150px] ${snapshot.isDraggingOver ? 'bg-[#EBECF0]' : ''}`}
                                    >
                                        {columnBugs.map((bug, index) => (
                                            <BugCard
                                                key={bug.id}
                                                bug={bug}
                                                index={index}
                                                onClick={(b) => navigate(`/projects/${projectId}/bugs/${b.id}`)}
                                            />
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
