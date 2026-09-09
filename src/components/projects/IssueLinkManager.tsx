import { useState } from 'react'
import { Link2, Unlink, Plus, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface IssueLink {
    relationship: 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates'
    targetDisplayId: string
}

interface IssueLinkManagerProps {
    ticketId: string
    ticketType: 'bug' | 'task'
    ticketDisplayId: string
    currentLabels?: any[]
    onLinksUpdated: () => void
}

const RELATIONSHIP_LABELS: Record<string, { label: string; inverse: string; color: string }> = {
    blocks: { label: 'Blocks', inverse: 'Is blocked by', color: 'bg-[#FFEBE6] text-[#DE350B] border-[#DE350B]' },
    is_blocked_by: { label: 'Is blocked by', inverse: 'Blocks', color: 'bg-[#FFFAE6] text-[#FF8B00] border-[#FF8B00]' },
    relates_to: { label: 'Relates to', inverse: 'Relates to', color: 'bg-[#DEEBFF] text-[#0747A6] border-[#0747A6]' },
    duplicates: { label: 'Duplicates', inverse: 'Is duplicated by', color: 'bg-[#EAE6FF] text-[#403294] border-[#403294]' }
}

export function parseIssueLinksFromLabels(labels: any[] = []): IssueLink[] {
    const links: IssueLink[] = []
    if (!Array.isArray(labels)) return links

    for (const item of labels) {
        if (typeof item === 'string' && item.startsWith('link:')) {
            // Format: link:relationship:TARGET_KEY
            const parts = item.split(':')
            if (parts.length >= 3) {
                const rel = parts[1] as any
                const targetKey = parts[2].toUpperCase()
                links.push({ relationship: rel, targetDisplayId: targetKey })
            }
        }
    }
    return links
}

export function IssueLinkManager({
    ticketId,
    ticketType,
    ticketDisplayId,
    currentLabels = [],
    onLinksUpdated
}: IssueLinkManagerProps) {
    const { user } = useAuth()
    const [relationship, setRelationship] = useState<'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates'>('blocks')
    const [targetInput, setTargetInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)

    const existingLinks = parseIssueLinksFromLabels(currentLabels)

    const handleAddLink = async () => {
        setError(null)
        const targetKey = targetInput.trim().toUpperCase()

        if (!targetKey) {
            setError('Please enter a target issue key (e.g. SQIP-1 or SQIP-T1)')
            return
        }

        if (targetKey === ticketDisplayId.toUpperCase()) {
            setError('An issue cannot link to itself')
            return
        }

        setLoading(true)

        try {
            const newLinkTag = `link:${relationship}:${targetKey}`
            
            // Avoid duplicate links
            const updatedLabels = Array.from(new Set([...currentLabels, newLinkTag]))
            const tableName = ticketType === 'bug' ? 'bugs' : 'tasks'

            // 1. Update current ticket labels
            const { error: updateError } = await supabase
                .from(tableName)
                .update({ labels: updatedLabels })
                .eq('id', ticketId)

            if (updateError) throw updateError

            // 2. Add activity log
            const activityTable = ticketType === 'bug' ? 'activity_log' : 'task_activity_log'
            const foreignKey = ticketType === 'bug' ? 'bug_id' : 'task_id'
            const relInfo = RELATIONSHIP_LABELS[relationship]

            await supabase.from(activityTable).insert({
                [foreignKey]: ticketId,
                user_id: user?.id,
                action: 'issue_linked',
                new_value: `${relInfo.label} ${targetKey}`
            })

            // 3. Post comment notification
            const commentTable = ticketType === 'bug' ? 'bug_comments' : 'task_comments'
            await supabase.from(commentTable).insert({
                [foreignKey]: ticketId,
                user_id: user?.id,
                content: `🔗 **Linked Issue:** This ${ticketType} ${relInfo.label.toLowerCase()} **${targetKey}**.`
            })

            setTargetInput('')
            setIsAdding(false)
            onLinksUpdated()
        } catch (err: any) {
            console.error('Error linking issue:', err)
            setError(err.message || 'Failed to link issue')
        } finally {
            setLoading(false)
        }
    }

    const handleRemoveLink = async (targetKeyToRemove: string, relToRemove: string) => {
        try {
            const tagToRemove = `link:${relToRemove}:${targetKeyToRemove}`
            const updatedLabels = currentLabels.filter(item => item !== tagToRemove)
            const tableName = ticketType === 'bug' ? 'bugs' : 'tasks'

            await supabase
                .from(tableName)
                .update({ labels: updatedLabels })
                .eq('id', ticketId)

            onLinksUpdated()
        } catch (err) {
            console.error('Error removing link:', err)
        }
    }

    return (
        <div className="space-y-3 text-sm text-[#172B4D]">
            <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-[#42526E] flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-[#0747A6]" />
                    Linked Issues ({existingLinks.length})
                </span>
                {!isAdding && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAdding(true)}
                        className="h-7 text-xs text-[#0747A6] hover:bg-[#DEEBFF] font-semibold flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Link Issue
                    </Button>
                )}
            </div>

            {/* Existing Links List */}
            {existingLinks.length > 0 ? (
                <div className="space-y-1.5">
                    {existingLinks.map((link, idx) => {
                        const relInfo = RELATIONSHIP_LABELS[link.relationship] || RELATIONSHIP_LABELS.relates_to
                        return (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-2 rounded border border-[#DFE1E6] bg-[#F4F5F7] text-xs hover:border-[#4C9AFF] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase ${relInfo.color}`}>
                                        {relInfo.label}
                                    </span>
                                    <span className="font-bold text-[#0747A6]">{link.targetDisplayId}</span>
                                </div>
                                <button
                                    onClick={() => handleRemoveLink(link.targetDisplayId, link.relationship)}
                                    title="Unlink Issue"
                                    className="text-[#6B778C] hover:text-[#DE350B] p-1 transition-colors"
                                >
                                    <Unlink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            ) : (
                !isAdding && (
                    <p className="text-xs text-[#6B778C] italic">No issues linked yet.</p>
                )
            )}

            {/* Add Link Form */}
            {isAdding && (
                <div className="p-3 border border-[#DFE1E6] bg-[#F4F5F7] rounded-md space-y-2.5">
                    {error && (
                        <div className="p-2 bg-[#FFEBE6] border border-[#DE350B] rounded text-[#DE350B] text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[11px] font-bold text-[#42526E] mb-1">
                                Relationship
                            </label>
                            <Select
                                value={relationship}
                                onValueChange={(val: any) => setRelationship(val)}
                            >
                                <SelectTrigger className="h-8 text-xs bg-white border-[#DFE1E6]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    <SelectItem value="blocks">Blocks</SelectItem>
                                    <SelectItem value="is_blocked_by">Is blocked by</SelectItem>
                                    <SelectItem value="relates_to">Relates to</SelectItem>
                                    <SelectItem value="duplicates">Duplicates</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-[#42526E] mb-1">
                                Target Issue Key
                            </label>
                            <Input
                                type="text"
                                placeholder="e.g. SQIP-1 or SQIP-T1"
                                value={targetInput}
                                onChange={e => setTargetInput(e.target.value)}
                                className="h-8 text-xs bg-white border-[#DFE1E6]"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsAdding(false)}
                            disabled={loading}
                            className="h-7 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAddLink}
                            disabled={loading}
                            className="h-7 text-xs bg-[#0747A6] hover:bg-[#0052CC] text-white font-semibold"
                        >
                            {loading ? 'Linking...' : 'Link'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
