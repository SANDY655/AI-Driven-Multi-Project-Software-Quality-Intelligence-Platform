import { useParams, Link } from 'react-router-dom'
import { TaskKanbanBoard } from '../components/projects/tasks/TaskKanbanBoard'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

import { useAuth } from '../contexts/AuthContext'
import { CreateTaskModal } from '../components/projects/tasks/CreateTaskModal'

export function TaskKanbanPage() {
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
        <div className="space-y-6 flex flex-col h-full min-h-0 w-full">
            {/* Header */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Link to={`/projects/${id}`} className="p-2 -ml-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            Tasks Board
                            <span className="text-xl text-zinc-500 font-normal ml-2">/ {project.name}</span>
                        </h1>
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

            {/* Board Container */}
            <div className="flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                <TaskKanbanBoard
                    projectId={id}
                    refreshTrigger={refreshTrigger}
                    userRole={project.project_members?.find((m: any) => m.profiles?.id === user?.id)?.project_role}
                />
            </div>
        </div>
    )
}
