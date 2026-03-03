import { Draggable } from '@hello-pangea/dnd'
import { Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export interface Bug {
    id: string
    bug_display_id: string
    title: string
    severity: string
    priority: string
    status: string
    created_at: string
    assigned_to?: string
    assignee?: {
        display_name: string
        avatar_url: string
    }
}

interface BugCardProps {
    bug: Bug
    index: number
    onClick: (bug: Bug) => void
    columnColor?: string
}

const priorityColors: Record<string, string> = {
    P0: 'bg-red-500/20 text-red-500 border-red-500/30',
    P1: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    P2: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    P3: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
}

const priorityLabels: Record<string, string> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
}

export function BugCard({ bug, index, onClick, columnColor }: BugCardProps) {
    return (
        <Draggable draggableId={bug.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(bug)}
                    className={`p-4 mb-3 rounded-[24px] bg-white border text-left shadow-sm cursor-pointer transition-all hover:shadow-md ${columnColor ? columnColor.replace('bg-', 'border-').replace('100', '200') : 'border-zinc-200'} ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-zinc-900/5' : 'hover:-translate-y-0.5'
                        }`}
                >
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-mono font-medium text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">{bug.bug_display_id}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${priorityColors[bug.priority] || priorityColors.P2}`}>
                            {priorityLabels[bug.priority] || bug.priority}
                        </span>
                    </div>

                    <h4 className="text-[15px] font-semibold text-zinc-800 mb-4 line-clamp-2 leading-snug">
                        {bug.title}
                    </h4>

                    <div className="flex items-center justify-between text-zinc-500 text-xs mt-auto">
                        <div className="flex items-center gap-2">
                            {bug.assignee ? (
                                bug.assignee.avatar_url ? (
                                    <img src={bug.assignee.avatar_url} alt="Assignee" className="h-6 w-6 rounded-full ring-2 ring-white shadow-sm" title={bug.assignee.display_name} />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center ring-2 ring-white shadow-sm text-[10px] font-semibold text-zinc-600" title={bug.assignee.display_name}>
                                        {bug.assignee.display_name.charAt(0)}
                                    </div>
                                )
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-zinc-50 flex items-center justify-center ring-2 ring-white border border-dashed border-zinc-300" title="Unassigned">
                                    <span className="text-[10px] text-zinc-400 font-medium">?</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1" title={new Date(bug.created_at).toLocaleString()}>
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(bug.created_at), { addSuffix: true }).replace('about ', '')}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    )
}
