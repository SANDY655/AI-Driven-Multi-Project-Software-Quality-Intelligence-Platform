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

    useEffect(() => {
        if (!id) return
        supabase.from('projects').select(`
            name, 
            project_code,
            project_members ( project_role, profiles (id) )
        `).eq('id', id).single().then(({ data }) => {
            if (data) setProject(data)
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
            </div>

            {/* Board Container */}
            <div className="flex-1 min-h-0 flex flex-col">
                <KanbanBoard
                    projectId={id}
                    refreshTrigger={refreshTrigger}
                    userRole={project.project_members?.find((m: any) => m.profiles?.id === user?.id)?.project_role}
                />
            </div>
        </div>
    )
}
