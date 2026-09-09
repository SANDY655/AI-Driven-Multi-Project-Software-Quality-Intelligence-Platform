import { useState } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface LogWorkModalProps {
    isOpen: boolean
    onClose: () => void
    ticketId: string
    ticketType: 'bug' | 'task'
    ticketDisplayId: string
    currentOriginalEstimate?: number // in minutes
    currentTimeSpent?: number // in minutes
    createdAt?: string
    commitsCount?: number
    onWorkLogged: () => void
}

// Parses string like "2h 30m", "1d 4h", "45m", "3h" into total minutes
export function parseTimeString(input: string): number | null {
    if (!input || !input.trim()) return null
    const cleaned = input.trim().toLowerCase()
    
    // Pure number input (assumed minutes)
    if (/^\d+$/.test(cleaned)) {
        return parseInt(cleaned, 10)
    }

    let totalMinutes = 0
    const dayMatch = cleaned.match(/(\d+)\s*d/)
    const hourMatch = cleaned.match(/(\d+)\s*h/)
    const minMatch = cleaned.match(/(\d+)\s*m/)

    if (!dayMatch && !hourMatch && !minMatch) return null

    if (dayMatch) totalMinutes += parseInt(dayMatch[1], 10) * 8 * 60 // 1 day = 8 working hours
    if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60
    if (minMatch) totalMinutes += parseInt(minMatch[1], 10)

    return totalMinutes
}

export function formatMinutes(totalMinutes: number): string {
    if (!totalMinutes || totalMinutes <= 0) return '0m'
    const days = Math.floor(totalMinutes / (8 * 60))
    const remMinutes = totalMinutes % (8 * 60)
    const hours = Math.floor(remMinutes / 60)
    const mins = remMinutes % 60

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (mins > 0) parts.push(`${mins}m`)

    return parts.join(' ')
}

export function LogWorkModal({
    isOpen,
    onClose,
    ticketId,
    ticketType,
    ticketDisplayId,
    currentOriginalEstimate = 0,
    currentTimeSpent = 0,
    createdAt,
    commitsCount = 0,
    onWorkLogged
}: LogWorkModalProps) {
    const { user } = useAuth()
    const [timeSpentInput, setTimeSpentInput] = useState('')
    const [originalEstimateInput, setOriginalEstimateInput] = useState(
        currentOriginalEstimate > 0 ? formatMinutes(currentOriginalEstimate) : ''
    )
    const [worklogNote, setWorklogNote] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSave = async () => {
        setError(null)
        const newSpentMinutes = parseTimeString(timeSpentInput)

        if (newSpentMinutes === null || newSpentMinutes <= 0) {
            setError('Please enter a valid time spent (e.g. 2h 30m, 45m, 1d 4h)')
            return
        }

        // Anti-Misuse Check 1: Mandatory work description note for entries > 4 hours
        if (newSpentMinutes > 240 && !worklogNote.trim()) {
            setError('AI Work Audit: Entries over 4 hours require a work description note explaining the progress made.')
            return
        }

        // Anti-Misuse Check 2: Total logged time cannot exceed calendar time elapsed since creation
        if (createdAt) {
            const createdTime = new Date(createdAt).getTime()
            const nowTime = new Date().getTime()
            const elapsedMins = Math.max(60, Math.floor((nowTime - createdTime) / (1000 * 60)))
            const totalSpent = currentTimeSpent + newSpentMinutes

            if (totalSpent > elapsedMins + 60) {
                setError(`AI Work Audit Discrepancy: Total logged work (${formatMinutes(totalSpent)}) cannot exceed calendar time elapsed since creation (${formatMinutes(elapsedMins)}).`)
                return
            }
        }

        const newOriginalEst = parseTimeString(originalEstimateInput) || currentOriginalEstimate
        const totalSpent = currentTimeSpent + newSpentMinutes

        setLoading(true)

        try {
            const tableName = ticketType === 'bug' ? 'bugs' : 'tasks'
            const foreignKey = ticketType === 'bug' ? 'bug_id' : 'task_id'

            // 1. Update ticket original estimate & time spent
            const { error: updateError } = await supabase
                .from(tableName)
                .update({
                    time_spent: totalSpent,
                    original_estimate: newOriginalEst
                })
                .eq('id', ticketId)

            if (updateError) throw updateError

            // 2. Insert worklog comment & activity log
            const logContent = `⏱️ **Logged Work:** ${formatMinutes(newSpentMinutes)}${
                worklogNote ? `\n*Note:* ${worklogNote}` : ''
            }\n*Total Spent:* ${formatMinutes(totalSpent)} / ${formatMinutes(newOriginalEst)}`

            const commentTable = ticketType === 'bug' ? 'bug_comments' : 'task_comments'
            await supabase.from(commentTable).insert({
                [foreignKey]: ticketId,
                user_id: user?.id,
                content: logContent
            })

            const activityTable = ticketType === 'bug' ? 'activity_log' : 'task_activity_log'
            await supabase.from(activityTable).insert({
                [foreignKey]: ticketId,
                user_id: user?.id,
                action: 'work_logged',
                new_value: `${formatMinutes(newSpentMinutes)} (Total: ${formatMinutes(totalSpent)})`
            })

            onWorkLogged()
            onClose()
            setTimeSpentInput('')
            setWorklogNote('')
        } catch (err: any) {
            console.error('Error logging work:', err)
            setError(err.message || 'Failed to log work')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px] bg-white border-[#DFE1E6]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#172B4D]">
                        <Clock className="w-5 h-5 text-[#0747A6]" />
                        Log Work on {ticketDisplayId}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm text-[#172B4D]">
                    {error && (
                        <div className="p-3 bg-[#FFEBE6] border border-[#DE350B] rounded text-[#DE350B] text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {commitsCount === 0 && (
                        <div className="p-2.5 bg-[#FFFAE6] border border-[#FF8B00] rounded text-[#172B4D] text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-[#FF8B00] flex-shrink-0" />
                            <span><strong>AI Audit Notice:</strong> 0 Git commits are linked to this ticket. Ensure you include a detailed work note.</span>
                        </div>
                    )}

                    {/* Time Spent Input */}
                    <div>
                        <label className="block text-xs font-bold text-[#42526E] uppercase mb-1">
                            Time Spent *
                        </label>
                        <Input
                            type="text"
                            placeholder="e.g. 2h 30m, 45m, 1d 4h"
                            value={timeSpentInput}
                            onChange={e => setTimeSpentInput(e.target.value)}
                            className="h-9 border-[#DFE1E6] focus:border-[#0747A6]"
                        />
                        <p className="text-[11px] text-[#6B778C] mt-1">
                            Use format: 2h 30m, 45m, 1d 4h (1d = 8 hours).
                        </p>
                    </div>

                    {/* Original Estimate Input */}
                    <div>
                        <label className="block text-xs font-bold text-[#42526E] uppercase mb-1">
                            Original Estimate
                        </label>
                        <Input
                            type="text"
                            placeholder="e.g. 8h, 1d 2h"
                            value={originalEstimateInput}
                            onChange={e => setOriginalEstimateInput(e.target.value)}
                            className="h-9 border-[#DFE1E6] focus:border-[#0747A6]"
                        />
                    </div>

                    {/* Work Description Note */}
                    <div>
                        <label className="block text-xs font-bold text-[#42526E] uppercase mb-1">
                            Work Description Note
                        </label>
                        <Textarea
                            placeholder="Describe what work was performed during this logged time..."
                            rows={3}
                            value={worklogNote}
                            onChange={e => setWorklogNote(e.target.value)}
                            className="border-[#DFE1E6] focus:border-[#0747A6] text-sm"
                        />
                    </div>

                    {/* Visual Progress Preview */}
                    <div className="p-3 bg-[#F4F5F7] rounded border border-[#DFE1E6] space-y-1.5">
                        <div className="flex justify-between text-xs text-[#42526E]">
                            <span>Current Logged: <strong className="text-[#172B4D]">{formatMinutes(currentTimeSpent)}</strong></span>
                            <span>Estimate: <strong className="text-[#172B4D]">{formatMinutes(currentOriginalEstimate)}</strong></span>
                        </div>
                        <div className="w-full bg-[#DFE1E6] h-2 rounded-full overflow-hidden flex">
                            <div
                                className="bg-[#00875A] h-full"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        currentOriginalEstimate > 0
                                            ? (currentTimeSpent / currentOriginalEstimate) * 100
                                            : 0
                                    )}%`
                                }}
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={loading} className="h-9">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="h-9 bg-[#0747A6] hover:bg-[#0052CC] text-white"
                    >
                        {loading ? 'Logging...' : 'Log Work'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
