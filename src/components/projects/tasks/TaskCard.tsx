import { Draggable } from '@hello-pangea/dnd'
import { CheckSquare, ArrowUp, ArrowDown, Minus, ArrowRight, Clock } from 'lucide-react'

export interface Task {
    id: string
    task_display_id: string
    title: string
    priority: string
    status: string
    created_at: string
    resolved_at?: string
    due_date?: string
    assigned_to?: string
    sprint_id?: string
    parent_id?: string
    assignee?: {
        display_name: string
        avatar_url: string
    }
    epic?: {
        name: string
    }
    story_points?: number
}

interface TaskCardProps {
    task: Task
    index: number
    onClick: (task: Task) => void
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
    
    // Jira Priority Icons
    const renderPriorityIcon = (priority: string) => {
        switch(priority) {
            case 'urgent':
            case 'high':
                return <ArrowUp className="w-4 h-4 text-[#DE350B]" />
            case 'medium':
                return <Minus className="w-4 h-4 text-[#FFAB00]" />
            case 'low':
                return <ArrowDown className="w-4 h-4 text-[#0065FF]" />
            default:
                return <ArrowRight className="w-4 h-4 text-[#5E6C84]" />
        }
    }

    // SLA Calculation
    const getSLADetails = () => {
        let slaHours = 0
        switch (task.priority) {
            case 'urgent': slaHours = 24; break;
            case 'high': slaHours = 48; break;
            case 'medium': slaHours = 24 * 7; break;
            case 'low': slaHours = 24 * 14; break;
            default: slaHours = 48;
        }

        const createdTime = new Date(task.created_at).getTime()
        const deadlineTime = createdTime + (slaHours * 60 * 60 * 1000)
        
        if (task.resolved_at) {
            const resolvedTime = new Date(task.resolved_at).getTime()
            return resolvedTime <= deadlineTime ? null : { color: 'text-[#DE350B]', title: 'SLA Breached' }
        }

        const now = new Date().getTime()
        const remaining = deadlineTime - now

        if (remaining < 0) {
            return { color: 'text-[#DE350B]', title: 'SLA Breached' }
        }
        
        const hoursLeft = Math.floor(remaining / (1000 * 60 * 60))
        if (hoursLeft < 24) {
            return { color: 'text-[#FF8B00]', title: 'SLA Warning' }
        }
        
        return null // Don't show SLA on cards if it's fine and > 24h away
    }

    const sla = getSLADetails()

    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(task)}
                    className={`bg-white rounded-[3px] p-2.5 cursor-pointer text-[#172B4D] hover:bg-[#FAFBFC] transition-colors border border-[#DFE1E6] ${snapshot.isDragging ? 'shadow-[0_4px_8px_rgba(9,30,66,0.25)] rotate-2' : 'shadow-[0_1px_2px_rgba(9,30,66,0.15)] hover:shadow-[0_1px_4px_rgba(9,30,66,0.2)]'}`}
                >
                    <div className="text-[14px] leading-[1.4] text-[#172B4D] mb-2 break-words">
                        {task.title}
                    </div>

                    {(task.epic || (task.story_points ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            {task.epic && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[11px] font-bold text-white bg-[#8777D9] leading-none">
                                    {task.epic.name}
                                </span>
                            )}
                            {(task.story_points ?? 0) > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold text-[#172B4D] bg-[#DFE1E6] leading-none">
                                    {task.story_points}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-[#E6FCFF] text-[#00B8D9] flex items-center justify-center flex-shrink-0" title="Task">
                                <CheckSquare className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-medium text-[#5E6C84] hover:text-[#0052CC] hover:underline" onClick={(e) => { e.stopPropagation(); onClick(task); }}>
                                {task.task_display_id}
                            </span>
                            {renderPriorityIcon(task.priority)}
                            {sla && <Clock className={`w-3.5 h-3.5 ${sla.color}`} />}
                        </div>
                        
                        <div className="flex items-center">
                            {task.assignee ? (
                                task.assignee.avatar_url ? (
                                    <img src={task.assignee.avatar_url} alt="Assignee" className="h-6 w-6 rounded-full" title={task.assignee.display_name} />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-[#0052CC] flex items-center justify-center text-[10px] font-bold text-white" title={task.assignee.display_name}>
                                        {task.assignee.display_name.charAt(0)}
                                    </div>
                                )
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-[#DFE1E6] flex items-center justify-center border border-dashed border-[#A5ADBA]" title="Unassigned">
                                    <span className="text-[10px] text-[#5E6C84] font-medium">?</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    )
}
