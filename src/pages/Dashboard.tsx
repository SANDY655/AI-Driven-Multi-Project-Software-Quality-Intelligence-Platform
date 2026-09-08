import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CreateProjectModal } from '../components/projects/CreateProjectModal'
import { FolderGit2, Briefcase, CheckCircle2, AlertCircle } from 'lucide-react'

interface Project {
    id: string
    name: string
    project_code: string
    description: string
    github_repo: string
    github_owner: string
    updated_at: string
}

interface AssignedItem {
    id: string;
    display_id: string;
    title: string;
    type: 'bug' | 'task';
    project_code: string;
    project_id: string;
    status: string;
    updated_at: string;
}

export function Dashboard() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])
    const [assignedItems, setAssignedItems] = useState<AssignedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'recent' | 'assigned'>('recent')

    const loadData = useCallback(async () => {
        if (!user) return

        // Load profile
        // Load projects this user is a member of
        const { data: projectsData, error: projErr } = await supabase
            .from('projects')
            .select('*, project_members!inner(project_id)')
            .eq('project_members.user_id', user.id)
            .order('updated_at', { ascending: false })

        if (projectsData && !projErr) {
            setProjects(projectsData)
        }

        // Load Assigned Bugs
        const { data: bugs } = await supabase
            .from('bugs')
            .select('id, bug_display_id, title, status, updated_at, projects(id, project_code)')
            .eq('assigned_to', user.id)
            .neq('status', 'resolved')
            .neq('status', 'closed')
            .order('updated_at', { ascending: false })
            .limit(10)
            
        // Load Assigned Tasks
        const { data: tasks } = await supabase
            .from('tasks')
            .select('id, task_display_id, title, status, updated_at, projects(id, project_code)')
            .eq('assigned_to', user.id)
            .neq('status', 'done')
            .order('updated_at', { ascending: false })
            .limit(10)

        const combined: AssignedItem[] = []
        if (bugs) {
            bugs.forEach((b: any) => combined.push({
                id: b.id,
                display_id: b.bug_display_id,
                title: b.title,
                type: 'bug',
                project_code: b.projects?.project_code || 'UNK',
                project_id: b.projects?.id,
                status: b.status,
                updated_at: b.updated_at
            }))
        }
        if (tasks) {
            tasks.forEach((t: any) => combined.push({
                id: t.id,
                display_id: t.task_display_id,
                title: t.title,
                type: 'task',
                project_code: t.projects?.project_code || 'UNK',
                project_id: t.projects?.id,
                status: t.status,
                updated_at: t.updated_at
            }))
        }

        // Sort combined by updated_at
        combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        setAssignedItems(combined)

        setLoading(false)
    }, [user])

    useEffect(() => {
        loadData()
    }, [loadData])


    if (loading) {
        return (
            <div className="flex-1 p-8 text-[#172B4D] animate-pulse">
                <div className="h-8 bg-[#EBECF0] w-48 rounded mb-6"></div>
                <div className="flex gap-4 mb-6">
                    <div className="h-6 bg-[#EBECF0] w-24 rounded"></div>
                    <div className="h-6 bg-[#EBECF0] w-24 rounded"></div>
                </div>
                <div className="space-y-4">
                    <div className="h-16 bg-[#EBECF0] rounded"></div>
                    <div className="h-16 bg-[#EBECF0] rounded"></div>
                    <div className="h-16 bg-[#EBECF0] rounded"></div>
                </div>
            </div>
        )
    }

    const getStatusBadge = (status: string) => {
        const normalizedStatus = status.toLowerCase();
        let bg = 'bg-[#DFE1E6]';
        let text = 'text-[#42526E]';

        if (normalizedStatus.includes('progress')) {
            bg = 'bg-[#E1ECFA]';
            text = 'text-[#0052CC]';
        } else if (normalizedStatus.includes('resolved') || normalizedStatus.includes('done') || normalizedStatus.includes('closed')) {
            bg = 'bg-[#E3FCEF]';
            text = 'text-[#006644]';
        }

        return (
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${bg} ${text}`}>
                {status.replace('_', ' ')}
            </span>
        )
    }

    return (
        <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 text-[#172B4D]">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-[24px] font-medium tracking-tight text-[#172B4D]">Your work</h1>
                <CreateProjectModal onSuccess={loadData} />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-[#DFE1E6] mb-6">
                <button 
                    onClick={() => setActiveTab('recent')}
                    className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'recent' ? 'text-[#0052CC]' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
                >
                    Recent projects
                    {activeTab === 'recent' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0052CC] rounded-t"></div>}
                </button>
                <button 
                    onClick={() => setActiveTab('assigned')}
                    className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'assigned' ? 'text-[#0052CC]' : 'text-[#5E6C84] hover:text-[#172B4D]'}`}
                >
                    Assigned to me <span className="ml-1.5 bg-[#EBECF0] text-[#42526E] px-1.5 py-0.5 rounded-full text-xs">{assignedItems.length}</span>
                    {activeTab === 'assigned' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#0052CC] rounded-t"></div>}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'recent' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.length === 0 ? (
                        <div className="col-span-full py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-[#DFE1E6] rounded-lg">
                            <FolderGit2 className="w-12 h-12 text-[#N30] mb-4 text-[#A5ADBA]" />
                            <h3 className="text-lg font-medium text-[#172B4D] mb-2">No projects yet</h3>
                            <p className="text-sm text-[#5E6C84] mb-6">You don't have any recent projects.</p>
                        </div>
                    ) : (
                        projects.map((project) => (
                            <Link
                                key={project.id}
                                to={`/projects/${project.id}`}
                                className="group bg-white border border-[#DFE1E6] rounded p-4 hover:shadow-[0_1px_4px_rgba(9,30,66,0.15)] transition-all block"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded bg-[#EAE6FF] text-[#403294] flex items-center justify-center font-bold text-sm flex-shrink-0">
                                        {project.project_code.substring(0,2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-[16px] font-medium text-[#172B4D] mb-1 group-hover:text-[#0052CC] transition-colors truncate">
                                            {project.name}
                                        </h3>
                                        <p className="text-xs text-[#5E6C84]">Software project</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-t border-[#DFE1E6] flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-[#5E6C84]">
                                        <Briefcase className="w-3.5 h-3.5" />
                                        {project.project_code}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'assigned' && (
                <div className="bg-white border border-[#DFE1E6] rounded">
                    {assignedItems.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center">
                            <CheckCircle2 className="w-12 h-12 text-[#36B37E] mb-4" />
                            <h3 className="text-lg font-medium text-[#172B4D] mb-2">You're all caught up</h3>
                            <p className="text-sm text-[#5E6C84]">There are no issues assigned to you.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[#DFE1E6]">
                                    <th className="py-2.5 px-4 text-xs font-bold text-[#5E6C84] uppercase tracking-wider w-8">T</th>
                                    <th className="py-2.5 px-4 text-xs font-bold text-[#5E6C84] uppercase tracking-wider w-24">Key</th>
                                    <th className="py-2.5 px-4 text-xs font-bold text-[#5E6C84] uppercase tracking-wider">Summary</th>
                                    <th className="py-2.5 px-4 text-xs font-bold text-[#5E6C84] uppercase tracking-wider w-32">Status</th>
                                    <th className="py-2.5 px-4 text-xs font-bold text-[#5E6C84] uppercase tracking-wider w-32 text-right">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignedItems.map(item => (
                                    <tr key={item.id} className="border-b border-[#DFE1E6] last:border-0 hover:bg-[#FAFBFC] transition-colors group cursor-pointer" onClick={() => navigate(`/projects/${item.project_id}/${item.type === 'bug' ? `bugs/${item.id}` : 'board'}`)}>
                                        <td className="py-2.5 px-4">
                                            {item.type === 'bug' ? (
                                                <div className="w-5 h-5 rounded bg-[#FFEBE6] text-[#DE350B] flex items-center justify-center" title="Bug">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded bg-[#E6FCFF] text-[#00B8D9] flex items-center justify-center" title="Task">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-4 text-sm font-medium text-[#5E6C84] group-hover:text-[#0052CC]">
                                            {item.display_id}
                                        </td>
                                        <td className="py-2.5 px-4 text-sm text-[#172B4D] font-medium">
                                            {item.title}
                                        </td>
                                        <td className="py-2.5 px-4">
                                            {getStatusBadge(item.status)}
                                        </td>
                                        <td className="py-2.5 px-4 text-xs text-[#5E6C84] text-right">
                                            {new Date(item.updated_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    )
}
