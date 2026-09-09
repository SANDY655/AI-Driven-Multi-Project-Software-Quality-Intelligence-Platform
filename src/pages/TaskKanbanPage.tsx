import { useParams, Link } from 'react-router-dom'
import { TaskKanbanBoard } from '../components/projects/tasks/TaskKanbanBoard'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

import { useAuth } from '../contexts/AuthContext'
import { CreateTaskModal } from '../components/projects/tasks/CreateTaskModal'

export function TaskKanbanPage() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [project, setProject] = useState<any>(null)
    const [activeSprint, setActiveSprint] = useState<any>(null)
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    useEffect(() => {
        if (!id) return
        supabase.from('projects').select(`
            name, 
            project_code,
            project_members ( project_role, profiles (id) )
        `).eq('id', id).single().then(({ data }) => {
            if (data) setProject(data)
        })

        supabase.from('sprints').select('*')
            .eq('project_id', id)
            .eq('status', 'active')
            .maybeSingle()
            .then(({ data }) => {
                setActiveSprint(data || null)
            })
    }, [id])

    if (!id || !project) return null


    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Header Area */}
            <div className="px-8 pt-8 pb-4 flex-shrink-0">
                {/* Breadcrumbs */}
                <div className="flex items-center text-sm text-[#5E6C84] mb-2 min-w-0">
                    <Link to="/projects" className="hover:underline flex-shrink-0">Projects</Link>
                    <span className="mx-2 flex-shrink-0">/</span>
                    <Link to={`/projects/${id}`} className="hover:underline max-w-[200px] sm:max-w-[320px] truncate inline-block align-bottom" title={project.name}>{project.name}</Link>
                    <span className="mx-2 flex-shrink-0">/</span>
                    <span className="text-[#172B4D] flex-shrink-0">Active Sprint</span>
                </div>

                <div className="flex justify-between items-end">
                    <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">
                        {activeSprint?.name || 'Active Sprint'}
                    </h1>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex items-center">
                            {/* Mock Avatars for filters */}
                            <div className="flex -space-x-1 mr-4">
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-[#FF5630] text-white flex items-center justify-center text-xs font-bold z-10">T</div>
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-[#0052CC] text-white flex items-center justify-center text-xs font-bold z-0">S</div>
                            </div>
                        </div>

                        {(() => {
                            const userMember = project.project_members?.find((m: any) => m.profiles?.id === user?.id)
                            const userRole = userMember?.project_role
                            const canCreateTask = ['admin', 'pm', 'tester', 'developer'].includes(userRole || '')

                            return canCreateTask && (
                                <CreateTaskModal
                                    projectId={id}
                                    projectCode={project.project_code}
                                    onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                                />
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* Board Container */}
            <div className="flex-1 min-h-0 flex flex-col relative">
                {!activeSprint ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                        <h2 className="text-xl font-bold text-[#172B4D] mb-2">No Active Sprint</h2>
                        <p className="text-[#5E6C84] mb-6">Start a sprint in the backlog to see tasks here.</p>
                        <Link to={`/projects/${id}/backlog`} className="px-4 py-2 bg-[#0052CC] text-white font-medium rounded hover:bg-[#0047B3] transition-colors">
                            Go to Backlog
                        </Link>
                    </div>
                ) : null}
                <TaskKanbanBoard
                    projectId={id}
                    refreshTrigger={refreshTrigger}
                    userRole={project.project_members?.find((m: any) => m.profiles?.id === user?.id)?.project_role}
                    sprintId={activeSprint?.id || 'NO_ACTIVE_SPRINT'}
                />
            </div>
        </div>
    )
}
