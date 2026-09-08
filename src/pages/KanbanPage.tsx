import { useParams, Link } from 'react-router-dom'
import { KanbanBoard } from '../components/projects/KanbanBoard'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

import { useAuth } from '../contexts/AuthContext'
import { CreateBugModal } from '../components/projects/CreateBugModal'

export function KanbanPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [project, setProject] = useState<any>(null)
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [members, setMembers] = useState<any[]>([])
    const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)

    useEffect(() => {
        if (!id) return
        supabase.from('projects').select(`
            name, 
            project_code,
            project_members ( project_role, profiles (id) )
        `).eq('id', id).single().then(({ data }) => {
            if (data) setProject(data)
        })

        // Fetch project members for quick filters
        supabase
            .from('project_members')
            .select(`profiles (id, display_name, avatar_url)`)
            .eq('project_id', id)
            .then(({ data }) => {
                if (data) setMembers(data.map((m: any) => m.profiles).filter(Boolean))
            })
    }, [id])

    if (!id || !project) return null


    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Header Area */}
            <div className="px-8 pt-8 pb-4 flex-shrink-0">
                {/* Breadcrumbs */}
                <div className="flex items-center text-sm text-[#5E6C84] mb-2">
                    <Link to="/projects" className="hover:underline">Projects</Link>
                    <span className="mx-2">/</span>
                    <Link to={`/projects/${id}`} className="hover:underline">{project.name}</Link>
                    <span className="mx-2">/</span>
                    <span className="text-[#172B4D]">Bug Board</span>
                </div>

                <div className="flex justify-between items-end">
                    <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">
                        Bug Board
                    </h1>
                    
                    <div className="flex items-center gap-3">
                        {(() => {
                            const userMember = project.project_members?.find((m: any) => m.profiles?.id === user?.id)
                            const userRole = userMember?.project_role
                            const canCreateBug = ['admin', 'pm', 'tester'].includes(userRole || '')

                            return canCreateBug && (
                                <CreateBugModal
                                    projectId={id}
                                    projectCode={project.project_code}
                                    onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                                />
                            )
                        })()}
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="mt-4 flex items-center gap-4">
                    <span className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Quick Filters</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setAssigneeFilter(null)}
                            className={`px-3 py-1.5 rounded-[3px] text-sm font-medium transition-colors ${!assigneeFilter ? 'bg-[#DEEBFF] text-[#0052CC]' : 'text-[#42526E] hover:bg-[#EBECF0]'}`}
                            title="Show all bugs"
                        >
                            All
                        </button>
                        <div className="w-px h-4 bg-[#DFE1E6] mx-2"></div>
                        {members.map(member => (
                            <button
                                key={member.id}
                                onClick={() => setAssigneeFilter(assigneeFilter === member.id ? null : member.id)}
                                className={`p-1 rounded-full transition-all ${assigneeFilter === member.id ? 'ring-2 ring-[#0052CC] ring-offset-1' : 'hover:opacity-80'}`}
                                title={`Filter by ${member.display_name}`}
                            >
                                {member.avatar_url ? (
                                    <img src={member.avatar_url} className="w-7 h-7 rounded-full" alt={member.display_name} />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold">
                                        {member.display_name?.charAt(0)}
                                    </div>
                                )}
                            </button>
                        ))}
                        {assigneeFilter && (
                            <span className="ml-2 text-xs text-[#5E6C84]">
                                Showing: <span className="font-semibold text-[#0052CC]">{members.find(m => m.id === assigneeFilter)?.display_name}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Board Container */}
            <div className="flex-1 min-h-0 flex flex-col">
                <KanbanBoard
                    projectId={id}
                    refreshTrigger={refreshTrigger}
                    assigneeFilter={assigneeFilter}
                    userRole={project.project_members?.find((m: any) => m.profiles?.id === user?.id)?.project_role}
                />
            </div>
        </div>
    )
}
