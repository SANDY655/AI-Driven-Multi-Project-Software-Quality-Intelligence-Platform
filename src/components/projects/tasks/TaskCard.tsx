import { Draggable } from '@hello-pangea/dnd'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface Task {
    id: string
    task_display_id: string
    title: string
    priority: string
    status: string
    created_at: string
    due_date?: string
    assigned_to?: string
    assignee?: {
        display_name: string
        avatar_url: string
    }
}

interface TaskCardProps {
    task: Task
    index: number
    onClick: (task: Task) => void
}

const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-500 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
}

const priorityLabels: Record<string, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
    return (
        <Draggable draggableId={task.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(task)}
                    className={`p-3 mb-2 rounded-lg border text-left cursor-pointer transition-colors ${snapshot.isDragging ? 'bg-zinc-800 border-zinc-600 shadow-xl' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80'
                        }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-mono text-zinc-500">{task.task_display_id}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${priorityColors[task.priority] || priorityColors.medium}`}>
                            {priorityLabels[task.priority] || task.priority}
                        </span>
                    </div>

                    <h4 className="text-sm font-medium text-white mb-3 line-clamp-2">
                        {task.title}
                    </h4>

                    <div className="flex items-center justify-between text-zinc-500 text-xs mt-auto">
                        <div className="flex items-center gap-2">
                            {task.assignee ? (
                                task.assignee.avatar_url ? (
                                    <img src={task.assignee.avatar_url} alt="Assignee" className="h-5 w-5 rounded-full ring-1 ring-zinc-700" title={task.assignee.display_name} />
                                ) : (
                                    <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700 text-[10px]" title={task.assignee.display_name}>
                                        {task.assignee.display_name.charAt(0)}
                                    </div>
                                )
                            ) : (
                                <div className="h-5 w-5 rounded-full bg-zinc-800/50 flex items-center justify-center ring-1 ring-zinc-800/50 border border-dashed border-zinc-600" title="Unassigned">
                                    <span className="text-[10px] text-zinc-600">?</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1" title={new Date(task.created_at).toLocaleString()}>
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(task.created_at), { addSuffix: true }).replace('about ', '')}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    )
}
