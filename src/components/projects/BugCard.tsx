import { Draggable } from '@hello-pangea/dnd'
import { AlertCircle, ArrowUp, ArrowDown, Minus, ArrowRight, Clock } from 'lucide-react'

export interface Bug {
    id: string
    bug_display_id: string
    title: string
    severity: string
    priority: string
    status: string
    created_at: string
    resolved_at?: string
    assigned_to?: string
    sprint_id?: string
    assignee?: {
        display_name: string
        avatar_url: string
    }
    epic?: {
        name: string
    }
    story_points?: number
}

interface BugCardProps {
    bug: Bug
    index: number
    onClick: (bug: Bug) => void
}

export function BugCard({ bug, index, onClick }: BugCardProps) {
    
    // Jira Priority Icons
    const renderPriorityIcon = (priority: string) => {
        switch(priority) {
            case 'P0':
                return <ArrowUp className="w-4 h-4 text-[#DE350B]" />
            case 'P1':
                return <ArrowUp className="w-4 h-4 text-[#FF5630]" />
            case 'P2':
                return <Minus className="w-4 h-4 text-[#FFAB00]" />
            case 'P3':
                return <ArrowDown className="w-4 h-4 text-[#0065FF]" />
            default:
                return <ArrowRight className="w-4 h-4 text-[#5E6C84]" />
        }
    }

    // SLA Calculation
    const getSLADetails = () => {
        let slaHours = 0
        switch (bug.priority) {
            case 'P0': slaHours = 24; break;
            case 'P1': slaHours = 48; break;
            case 'P2': slaHours = 24 * 7; break;
            case 'P3': slaHours = 24 * 14; break;
            default: slaHours = 48;
        }

        const createdTime = new Date(bug.created_at).getTime()
        const deadlineTime = createdTime + (slaHours * 60 * 60 * 1000)
        
        if (bug.resolved_at) {
            const resolvedTime = new Date(bug.resolved_at).getTime()
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
        <Draggable draggableId={bug.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    onClick={() => onClick(bug)}
                    className={`bg-white rounded-[3px] p-2.5 cursor-pointer text-[#172B4D] hover:bg-[#FAFBFC] transition-colors border border-[#DFE1E6] ${snapshot.isDragging ? 'shadow-[0_4px_8px_rgba(9,30,66,0.25)] rotate-2' : 'shadow-[0_1px_2px_rgba(9,30,66,0.15)] hover:shadow-[0_1px_4px_rgba(9,30,66,0.2)]'}`}
                >
                    <div className="text-[14px] leading-[1.4] text-[#172B4D] mb-2 break-words">
                        {bug.title}
                    </div>

                    {((bug as any).labels || []).some((l: any) => typeof l === 'string' && l.startsWith('link:is_blocked_by:')) && (
                        <div className="mb-2">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFFAE6] text-[#FF8B00] border border-[#FF8B00]">
                                ⚠️ Blocked
                            </span>
                        </div>
                    )}

                    {(bug.epic || (bug.story_points ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-2 items-center mb-3">
                            {bug.epic && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] text-[11px] font-bold text-white bg-[#8777D9] leading-none">
                                    {bug.epic.name}
                                </span>
                            )}
                            {(bug.story_points ?? 0) > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold text-[#172B4D] bg-[#DFE1E6] leading-none">
                                    {bug.story_points}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 rounded bg-[#FFEBE6] text-[#DE350B] flex items-center justify-center flex-shrink-0" title="Bug">
                                <AlertCircle className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-medium text-[#5E6C84] hover:text-[#0052CC] hover:underline" onClick={(e) => { e.stopPropagation(); onClick(bug); }}>
                                {bug.bug_display_id}
                            </span>
                            {renderPriorityIcon(bug.priority)}
                            {sla && <Clock className={`w-3.5 h-3.5 ${sla.color}`} />}
                        </div>
                        
                        <div className="flex items-center">
                            {bug.assignee ? (
                                bug.assignee.avatar_url ? (
                                    <img src={bug.assignee.avatar_url} alt="Assignee" className="h-6 w-6 rounded-full" title={bug.assignee.display_name} />
                                ) : (
                                    <div className="h-6 w-6 rounded-full bg-[#0052CC] flex items-center justify-center text-[10px] font-bold text-white" title={bug.assignee.display_name}>
                                        {bug.assignee.display_name.charAt(0)}
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
