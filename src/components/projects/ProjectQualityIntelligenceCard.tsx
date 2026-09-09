import { useState, useEffect } from 'react'
import { ShieldCheck, Sparkles, Activity, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface ProjectQualityProps {
    projectId: string
    projectCode?: string
}

export function ProjectQualityIntelligenceCard({ projectId, projectCode }: ProjectQualityProps) {
    const [loading, setLoading] = useState(true)
    const [bugs, setBugs] = useState<any[]>([])
    const [tasks, setTasks] = useState<any[]>([])
    const [comments, setComments] = useState<any[]>([])

    useEffect(() => {
        async function loadQualityData() {
            setLoading(true)
            try {
                const [bugsRes, tasksRes, commentsRes] = await Promise.all([
                    supabase.from('bugs').select('*').eq('project_id', projectId),
                    supabase.from('tasks').select('*').eq('project_id', projectId),
                    supabase.from('bug_comments').select('*')
                ])

                if (bugsRes.data) setBugs(bugsRes.data)
                if (tasksRes.data) setTasks(tasksRes.data)
                if (commentsRes.data) setComments(commentsRes.data)
            } catch (err) {
                console.error('Error loading quality metrics:', err)
            } finally {
                setLoading(false)
            }
        }

        loadQualityData()
    }, [projectId])

    if (loading) {
        return (
            <div className="bg-white border border-[#DFE1E6] rounded-xl p-6 shadow-xs animate-pulse space-y-4">
                <div className="h-4 bg-[#EBECF0] rounded w-1/3"></div>
                <div className="h-16 bg-[#EBECF0] rounded"></div>
            </div>
        )
    }

    const totalBugs = bugs.length
    const resolvedBugs = bugs.filter(b => ['resolved', 'closed'].includes(b.status?.toLowerCase())).length
    const openBugs = totalBugs - resolvedBugs
    const criticalBugs = bugs.filter(b => ['p0', 'p1', 'critical', 'high'].includes((b.priority || b.severity || '').toLowerCase()) && !['resolved', 'closed'].includes(b.status?.toLowerCase())).length

    // Resolution Rate & Quality Health Score
    const resolutionRate = totalBugs > 0 ? Math.round((resolvedBugs / totalBugs) * 100) : 100
    
    // Quality Score Calculation (100 base, -25 per open P0/P1 bug, -10 per open P2 bug)
    let healthScore = 100
    healthScore -= criticalBugs * 20
    healthScore -= Math.min(30, openBugs * 5)
    healthScore = Math.max(20, Math.min(100, healthScore))

    // AI Code Review Comments
    const aiCommentsCount = comments.filter(c => typeof c.content === 'string' && c.content.includes('AI Code Review Assistant')).length

    return (
        <div className="bg-white border border-[#DFE1E6] rounded-xl p-6 shadow-xs space-y-6">
            {/* Title Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DFE1E6] pb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0747A6] to-[#6554C0] text-white flex items-center justify-center font-bold shadow-xs">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[#172B4D] flex items-center gap-2">
                            Software Quality Intelligence Hub
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE6FF] text-[#403294] uppercase tracking-wider border border-[#403294]/20 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#FFAB00]" /> AI Quality Core
                            </span>
                        </h2>
                        <p className="text-xs text-[#5E6C84]">Real-time defect density, resolution SLAs, and AI code review health</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-bold text-xs ${
                        healthScore >= 80 
                            ? 'bg-[#E3FCEF] border-[#006644] text-[#006644]' 
                            : healthScore >= 60 
                            ? 'bg-[#FFFAE6] border-[#FF8B00] text-[#172B4D]' 
                            : 'bg-[#FFEBE6] border-[#DE350B] text-[#DE350B]'
                    }`}>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Quality Score: {healthScore}/100</span>
                    </div>
                </div>
            </div>

            {/* Quality Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                        <span>Bug Resolution Rate</span>
                        <CheckCircle2 className="w-4 h-4 text-[#00875A]" />
                    </div>
                    <div className="text-2xl font-bold text-[#172B4D]">{resolutionRate}%</div>
                    <div className="text-[11px] text-[#00875A] font-semibold">{resolvedBugs} of {totalBugs} bugs resolved</div>
                </div>

                <div className="p-3.5 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                        <span>Critical Blockers</span>
                        <AlertCircle className="w-4 h-4 text-[#DE350B]" />
                    </div>
                    <div className="text-2xl font-bold text-[#DE350B]">{criticalBugs}</div>
                    <div className="text-[11px] text-[#DE350B] font-semibold">P0 / P1 Open Defects</div>
                </div>

                <div className="p-3.5 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                        <span>AI Code Reviews</span>
                        <Sparkles className="w-4 h-4 text-[#6554C0]" />
                    </div>
                    <div className="text-2xl font-bold text-[#172B4D]">{aiCommentsCount}</div>
                    <div className="text-[11px] text-[#6554C0] font-semibold">Automated Git Audits</div>
                </div>

                <div className="p-3.5 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-[#5E6C84]">
                        <span>Active Agile Tasks</span>
                        <BarChart3 className="w-4 h-4 text-[#0747A6]" />
                    </div>
                    <div className="text-2xl font-bold text-[#172B4D]">{tasks.length}</div>
                    <div className="text-[11px] text-[#0747A6] font-semibold">Tracked Sprint Tasks</div>
                </div>
            </div>

            {/* AI Executive Quality Insights */}
            <div className="p-4 bg-gradient-to-r from-[#F4F5F7] to-[#EAE6FF]/40 rounded-lg border border-[#DFE1E6] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#172B4D]">
                    <Sparkles className="w-4 h-4 text-[#6554C0]" />
                    AI Software Quality Assessment ({projectCode})
                </div>
                <p className="text-xs text-[#42526E] leading-relaxed">
                    {healthScore >= 85 ? (
                        `Project ${projectCode} is demonstrating high quality stability with a ${resolutionRate}% resolution rate and low blocker density. AI Code Review bot actively auditing incoming pull requests.`
                    ) : (
                        `Project ${projectCode} currently has ${criticalBugs} critical blocker(s) requiring immediate resolution. Recommend utilizing AI Assignee Recommendation to match expert developers.`
                    )}
                </p>
            </div>
        </div>
    )
}
