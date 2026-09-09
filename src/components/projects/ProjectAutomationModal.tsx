import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Zap, CheckCircle2, GitCommit, UserCheck, Bot, Sparkles, X, ShieldAlert } from 'lucide-react'

interface AutomationRule {
    id: string
    title: string
    description: string
    trigger: string
    action: string
    category: 'workflow' | 'git' | 'ai'
    icon: any
    enabled: boolean
}

interface ProjectAutomationModalProps {
    isOpen: boolean
    onClose: () => void
    projectId: string
}

export function ProjectAutomationModal({ isOpen, onClose, projectId: _projectId }: ProjectAutomationModalProps) {
    const [rules, setRules] = useState<AutomationRule[]>([
        {
            id: 'auto-assign',
            title: 'Auto-assign on "In Progress"',
            description: 'When an issue status is moved to "In Progress", automatically assign the issue to the active user.',
            trigger: 'Status changed to In Progress',
            action: 'Assign to active user',
            category: 'workflow',
            icon: UserCheck,
            enabled: true
        },
        {
            id: 'subtask-autosync',
            title: 'Auto-complete Task when Sub-tasks Done',
            description: 'When all checklist sub-tasks are checked, automatically update the parent Task status to "Done".',
            trigger: 'All sub-tasks marked complete',
            action: 'Set status = Done',
            category: 'workflow',
            icon: CheckCircle2,
            enabled: true
        },
        {
            id: 'git-webhook-sla',
            title: 'Git Commit Auto-Resolve & AI Review',
            description: 'When a commit message contains "Fixes #KEY" or "Resolves #KEY", auto-link the commit, compute SLA resolution time, and run AI Code Review.',
            trigger: 'Commit pushed with ticket key',
            action: 'Link commit + AI review + status = Resolved',
            category: 'git',
            icon: GitCommit,
            enabled: true
        },
        {
            id: 'ai-autotriage',
            title: 'AI Auto-Triage & Developer Suggestion',
            description: 'When a bug report is created, automatically predict priority/severity and recommend matching developers.',
            trigger: 'Issue created',
            action: 'Predict priority + suggest assignees',
            category: 'ai',
            icon: Bot,
            enabled: true
        }
    ])

    const [savedNotice, setSavedNotice] = useState(false)

    function toggleRule(id: string) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
        setSavedNotice(true)
        setTimeout(() => setSavedNotice(false), 2500)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden border-[#DFE1E6] rounded-lg shadow-xl">
                {/* Header */}
                <div className="bg-[#0747A6] px-6 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                                Jira Automation Rules
                                <span className="bg-amber-400 text-[#0747A6] text-[10px] uppercase font-extrabold px-2 py-0.5 rounded">Agile Engine</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-blue-100">
                                Automated triggers & AI workflows for project tasks and bugs
                            </DialogDescription>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded transition-colors text-white/80 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Notification */}
                {savedNotice && (
                    <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-6 py-2 text-xs font-semibold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        Automation rule settings updated successfully!
                    </div>
                )}

                {/* Rules List */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {rules.map(rule => {
                        const Icon = rule.icon
                        return (
                            <div key={rule.id} className={`p-4 rounded-lg border transition-all ${rule.enabled ? 'border-[#0052CC]/40 bg-[#F4F5F7]' : 'border-[#DFE1E6] bg-slate-50 opacity-75'}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded.md ${rule.category === 'ai' ? 'bg-purple-100 text-purple-700' : rule.category === 'git' ? 'bg-blue-100 text-[#0052CC]' : 'bg-emerald-100 text-emerald-700'}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-sm text-[#172B4D]">{rule.title}</h4>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${rule.category === 'ai' ? 'bg-purple-100 text-purple-700' : rule.category === 'git' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                                    {rule.category}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[#5E6C84] mt-1 leading-relaxed">{rule.description}</p>

                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                                <span className="bg-white border border-[#DFE1E6] text-[#42526E] px-2 py-0.5 rounded font-mono">
                                                    WHEN: {rule.trigger}
                                                </span>
                                                <span className="text-[#5E6C84]">→</span>
                                                <span className="bg-white border border-[#DFE1E6] text-[#0052CC] font-semibold px-2 py-0.5 rounded font-mono">
                                                    THEN: {rule.action}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toggle */}
                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-1">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={() => toggleRule(rule.id)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0052CC]"></div>
                                    </label>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div className="bg-[#FAFBFC] px-6 py-3 border-t border-[#DFE1E6] flex items-center justify-between text-xs text-[#5E6C84]">
                    <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-[#0052CC]" />
                        Rules apply automatically across Sprints, Backlog, and Kanban boards.
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-[#0052CC] hover:bg-[#0047B3] text-white font-bold rounded transition-colors"
                    >
                        Done
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
