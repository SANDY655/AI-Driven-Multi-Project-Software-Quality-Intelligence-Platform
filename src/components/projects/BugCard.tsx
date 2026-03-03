import { Draggable } from '@hello-pangea/dnd'
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
    P0: 'text-red-500',
    P1: 'text-orange-500',
    P2: 'text-yellow-600',
    P3: 'text-emerald-500',
}

const priorityLabels: Record<string, string> = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Medium',
    P3: 'Low',
}

export function BugCard({ bug, index, onClick, columnColor }: BugCardProps) {
    // Determine progress bar color based on column background
    const progressBarColor = columnColor?.includes('pink') ? 'bg-pink-400'
        : columnColor?.includes('orange') ? 'bg-orange-400'
            : columnColor?.includes('cyan') ? 'bg-cyan-400'
                : columnColor?.includes('purple') ? 'bg-purple-400'
                    : 'bg-green-400';

    return (
        <Draggable draggableId={bug.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(bug)}
                    className={`p-5 rounded-2xl text-left cursor-pointer transition-all duration-200 ${snapshot.isDragging ? 'bg-white shadow-2xl scale-105 rotate-2' : 'bg-white shadow-sm hover:shadow-md'
                        }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className={`text-[11px] font-bold tracking-wide ${priorityColors[bug.priority] || priorityColors.P2}`}>
                            {priorityLabels[bug.priority] || bug.priority}
                        </span>
                    </div>

                    <h4 className="text-[14px] font-bold text-zinc-800 mb-4 leading-snug">
                        {bug.title}
                    </h4>

                    {/* Fake Progress Bar (for Dribbble accuracy) */}
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-zinc-400 font-medium">Progress</span>
                        <span className="text-[10px] text-zinc-400 font-medium">{(index * 25) % 100}%</span>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-5">
                        <div className={`${progressBarColor} h-1.5 rounded-full`} style={{ width: `${(index * 25) % 100}%` }}></div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                        <div className="flex items-center">
                            {bug.assignee ? (
                                bug.assignee.avatar_url ? (
                                    <img src={bug.assignee.avatar_url} alt="Assignee" className="h-6 w-6 rounded-full border-2 border-white shadow-sm" title={bug.assignee.display_name} />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-zinc-200 flex items-center justify-center border-2 border-white shadow-sm text-[10px] text-zinc-600 font-bold" title={bug.assignee.display_name}>
                                        {bug.assignee.display_name.charAt(0)}
                                    </div>
                                )
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center border-2 border-white shadow-sm border-dashed border-zinc-300" title="Unassigned">
                                    <span className="text-[10px] text-zinc-400">?</span>
                                </div>
                            )}
                            {/* Fake overlapping avatar for accuracy */}
                            <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm text-[10px] text-blue-600 font-bold -ml-2">
                                +
                            </div>
                        </div>

                        <div className="flex items-center gap-3 text-zinc-400">
                            <div className="flex items-center gap-1 group">
                                <svg className="w-3.5 h-3.5 group-hover:text-zinc-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="text-[11px] font-medium">{index}</span>
                            </div>
                            <div className="flex items-center gap-1 group">
                                <svg className="w-3.5 h-3.5 group-hover:text-zinc-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="text-[11px] font-medium">{index + 2}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    )
}
