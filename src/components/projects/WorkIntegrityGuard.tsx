import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react'

export interface WorkIntegrityAnalysis {
    status: 'verified' | 'warning_no_commits' | 'warning_time_inflation' | 'warning_over_estimate' | 'pending'
    score: number // 0 to 100
    messages: string[]
}

interface WorkIntegrityGuardProps {
    createdAt?: string
    timeSpentMins?: number
    originalEstimateMins?: number
    commitsCount?: number
    branchesCount?: number
    isResolved?: boolean
}

export function analyzeWorkIntegrity({
    createdAt,
    timeSpentMins = 0,
    originalEstimateMins = 0,
    commitsCount = 0,
    branchesCount = 0
}: WorkIntegrityGuardProps): WorkIntegrityAnalysis {
    const messages: string[] = []
    let score = 100
    let hasTimeInflation = false
    let hasNoCommitsWarning = false
    let hasOverEstimateWarning = false

    // 1. Check elapsed hours since creation
    if (createdAt && timeSpentMins > 0) {
        const createdDate = new Date(createdAt)
        const now = new Date()
        const elapsedHours = Math.max(1, (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60))
        const loggedHours = timeSpentMins / 60

        // Discrepancy: Logged hours exceed total time elapsed since creation!
        if (loggedHours > elapsedHours + 0.5) {
            hasTimeInflation = true
            score -= 50
            messages.push(`Logged hours (${loggedHours.toFixed(1)}h) exceed calendar time elapsed since creation (${elapsedHours.toFixed(1)}h).`)
        }
    }

    // 2. Check Git Commit backing
    const totalDevActivity = commitsCount + branchesCount
    if (timeSpentMins >= 120 && totalDevActivity === 0) {
        hasNoCommitsWarning = true
        score -= 30
        messages.push(`High work logged (${(timeSpentMins / 60).toFixed(1)}h) with 0 Git commits or branches linked.`)
    }

    // 3. Check Estimate Variance (> 150% of original estimate)
    if (originalEstimateMins > 0 && timeSpentMins > originalEstimateMins * 1.5) {
        hasOverEstimateWarning = true
        score -= 15
        messages.push(`Time logged (${(timeSpentMins / 60).toFixed(1)}h) exceeds original estimate by over 50%.`)
    }

    // Determine status badge
    let status: WorkIntegrityAnalysis['status'] = 'verified'
    if (hasTimeInflation) {
        status = 'warning_time_inflation'
    } else if (hasNoCommitsWarning) {
        status = 'warning_no_commits'
    } else if (hasOverEstimateWarning) {
        status = 'warning_over_estimate'
    } else if (timeSpentMins === 0) {
        status = 'pending'
    }

    return {
        status,
        score: Math.max(0, score),
        messages
    }
}

export function WorkIntegrityGuard(props: WorkIntegrityGuardProps) {
    const analysis = analyzeWorkIntegrity(props)

    if (props.timeSpentMins === 0 && (props.commitsCount || 0) === 0) {
        return (
            <div className="p-2.5 bg-[#FAFBFC] border border-[#DFE1E6] rounded text-xs flex items-center justify-between text-[#5E6C84]">
                <span className="flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-[#5E6C84]" />
                    AI Work Audit
                </span>
                <span className="text-[11px]">No work logged yet</span>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {/* Main Shield Status Header */}
            <div
                className={`p-2.5 rounded border flex items-center justify-between text-xs transition-colors ${
                    analysis.status === 'verified'
                        ? 'bg-[#E3FCEF] border-[#006644] text-[#006644]'
                        : analysis.status === 'warning_time_inflation'
                        ? 'bg-[#FFEBE6] border-[#DE350B] text-[#DE350B]'
                        : 'bg-[#FFFAE6] border-[#FF8B00] text-[#172B4D]'
                }`}
            >
                <div className="flex items-center gap-2 font-semibold">
                    {analysis.status === 'verified' ? (
                        <ShieldCheck className="w-4 h-4 text-[#00875A]" />
                    ) : analysis.status === 'warning_time_inflation' ? (
                        <ShieldAlert className="w-4 h-4 text-[#DE350B]" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-[#FF8B00]" />
                    )}

                    <span>
                        {analysis.status === 'verified' && 'Verified Work Integrity'}
                        {analysis.status === 'warning_time_inflation' && 'Audit Flag: Time Discrepancy'}
                        {analysis.status === 'warning_no_commits' && 'Audit Warning: Unbacked Hours'}
                        {analysis.status === 'warning_over_estimate' && 'Notice: Exceeds Estimate'}
                    </span>
                </div>

                <span className="font-bold font-mono text-[11px] px-1.5 py-0.5 rounded bg-white/60">
                    Score: {analysis.score}/100
                </span>
            </div>

            {/* Audit Feedback Details */}
            {analysis.messages.length > 0 && (
                <div className="p-2 bg-[#FAFBFC] border border-[#DFE1E6] rounded text-[11px] space-y-1 text-[#42526E]">
                    <div className="font-bold text-[#172B4D] flex items-center gap-1">
                        🔍 AI Audit Observations:
                    </div>
                    {analysis.messages.map((msg, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[#5E6C84]">
                            <span className="text-[#DE350B] font-bold">•</span>
                            <span>{msg}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
