import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Bug, CheckSquare, Folder } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface JiraCommandPaletteProps {
    isOpen: boolean
    onClose: () => void
    onOpenCreateModal?: (type: 'bug' | 'task') => void
}

export function JiraCommandPalette({
    isOpen,
    onClose,
    onOpenCreateModal
}: JiraCommandPaletteProps) {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [bugs, setBugs] = useState<any[]>([])
    const [tasks, setTasks] = useState<any[]>([])
    const [projects, setProjects] = useState<any[]>([])

    useEffect(() => {
        if (!isOpen) {
            setQuery('')
            return
        }

        async function fetchSearchResults() {
            try {
                const [bugsRes, tasksRes, projRes] = await Promise.all([
                    supabase
                        .from('bugs')
                        .select('id, bug_display_id, title, project_id, status, priority')
                        .order('updated_at', { ascending: false })
                        .limit(10),
                    supabase
                        .from('tasks')
                        .select('id, task_display_id, title, project_id, status, priority')
                        .order('updated_at', { ascending: false })
                        .limit(10),
                    supabase
                        .from('projects')
                        .select('id, name, project_code')
                        .order('updated_at', { ascending: false })
                        .limit(5)
                ])

                if (bugsRes.data) setBugs(bugsRes.data)
                if (tasksRes.data) setTasks(tasksRes.data)
                if (projRes.data) setProjects(projRes.data)
            } catch (err) {
                console.error('Error in command palette search:', err)
            }
        }

        fetchSearchResults()
    }, [isOpen])

    const filteredBugs = bugs.filter(
        b =>
            b.bug_display_id.toLowerCase().includes(query.toLowerCase()) ||
            b.title.toLowerCase().includes(query.toLowerCase())
    )

    const filteredTasks = tasks.filter(
        t =>
            t.task_display_id.toLowerCase().includes(query.toLowerCase()) ||
            t.title.toLowerCase().includes(query.toLowerCase())
    )

    const filteredProjects = projects.filter(
        p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.project_code.toLowerCase().includes(query.toLowerCase())
    )

    const handleSelectBug = (b: any) => {
        onClose()
        navigate(`/projects/${b.project_id}?bug=${b.id}`)
    }

    const handleSelectTask = (t: any) => {
        onClose()
        navigate(`/projects/${t.project_id}?task=${t.id}`)
    }

    const handleSelectProject = (p: any) => {
        onClose()
        navigate(`/projects/${p.id}`)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[620px] p-0 bg-white border-[#DFE1E6] overflow-hidden shadow-2xl rounded-lg">
                {/* Search Bar Header */}
                <div className="flex items-center px-4 py-3 border-b border-[#DFE1E6] bg-[#F4F5F7] gap-3">
                    <Search className="w-5 h-5 text-[#0747A6]" />
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search Jira issues, keys (e.g. SQIP-1), projects, or type command..."
                        className="flex-1 bg-transparent text-sm text-[#172B4D] placeholder-[#6B778C] focus:outline-none"
                    />
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[#DFE1E6] bg-white px-1.5 font-mono text-[10px] font-semibold text-[#6B778C]">
                        ESC
                    </kbd>
                </div>

                {/* Results Container */}
                <div className="max-h-[380px] overflow-y-auto p-2 space-y-3">
                    {/* Quick Quick Actions */}
                    {!query && (
                        <div className="space-y-1">
                            <div className="text-[11px] font-bold uppercase text-[#6B778C] px-2 pt-1">
                                Quick Actions
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    onClick={() => {
                                        onClose()
                                        onOpenCreateModal?.('bug')
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-[#FFEBE6] text-[#DE350B] font-medium transition-colors text-left"
                                >
                                    <Bug className="w-4 h-4" />
                                    Create New Bug
                                </button>
                                <button
                                    onClick={() => {
                                        onClose()
                                        onOpenCreateModal?.('task')
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-[#DEEBFF] text-[#0747A6] font-medium transition-colors text-left"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Create New Task
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Bugs Results */}
                    {filteredBugs.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold uppercase text-[#6B778C] px-2 pb-1">
                                Bugs ({filteredBugs.length})
                            </div>
                            {filteredBugs.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => handleSelectBug(b)}
                                    className="flex items-center justify-between px-3 py-2 rounded text-xs hover:bg-[#EBECF0] cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <Bug className="w-4 h-4 text-[#DE350B] flex-shrink-0" />
                                        <span className="font-bold text-[#0747A6] group-hover:underline flex-shrink-0">
                                            {b.bug_display_id}
                                        </span>
                                        <span className="truncate text-[#172B4D]">{b.title}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFEBE6] text-[#DE350B] uppercase">
                                        {b.priority || 'P2'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tasks Results */}
                    {filteredTasks.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold uppercase text-[#6B778C] px-2 pb-1">
                                Tasks ({filteredTasks.length})
                            </div>
                            {filteredTasks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelectTask(t)}
                                    className="flex items-center justify-between px-3 py-2 rounded text-xs hover:bg-[#EBECF0] cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        <CheckSquare className="w-4 h-4 text-[#4C9AFF] flex-shrink-0" />
                                        <span className="font-bold text-[#0747A6] group-hover:underline flex-shrink-0">
                                            {t.task_display_id}
                                        </span>
                                        <span className="truncate text-[#172B4D]">{t.title}</span>
                                    </div>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DEEBFF] text-[#0747A6] uppercase">
                                        {t.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Projects Results */}
                    {filteredProjects.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold uppercase text-[#6B778C] px-2 pb-1">
                                Projects ({filteredProjects.length})
                            </div>
                            {filteredProjects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => handleSelectProject(p)}
                                    className="flex items-center justify-between px-3 py-2 rounded text-xs hover:bg-[#EBECF0] cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Folder className="w-4 h-4 text-[#0747A6]" />
                                        <span className="font-bold text-[#172B4D]">{p.name}</span>
                                        <span className="text-[#6B778C] font-mono">({p.project_code})</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {filteredBugs.length === 0 && filteredTasks.length === 0 && filteredProjects.length === 0 && (
                        <div className="p-8 text-center text-xs text-[#6B778C]">
                            No matching issues or projects found for "{query}".
                        </div>
                    )}
                </div>

                {/* Footer instructions */}
                <div className="px-4 py-2 border-t border-[#DFE1E6] bg-[#F4F5F7] text-[11px] text-[#6B778C] flex justify-between items-center">
                    <span>Press <kbd className="font-semibold text-[#172B4D]">Ctrl + K</kbd> anywhere to open</span>
                    <span>Jira Quick Command Palette</span>
                </div>
            </DialogContent>
        </Dialog>
    )
}
