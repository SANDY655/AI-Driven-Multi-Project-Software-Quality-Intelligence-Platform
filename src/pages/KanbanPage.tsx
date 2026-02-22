import { useParams, Link } from 'react-router-dom'
import { KanbanBoard } from '../components/projects/KanbanBoard'
import { ArrowLeft } from 'lucide-react'
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
            project_members ( profiles (id) )
        `).eq('id', id).single().then(({ data }) => {
            if (data) setProject(data)
        })
    }, [id])

    if (!id || !project) return null

    const isMember = project.project_members?.some((m: any) => m.profiles?.id === user?.id)

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
                            Bug Board
                            <span className="text-xl text-zinc-500 font-normal ml-2">/ {project.name}</span>
                        </h1>
                    </div>
                </div>
                {isMember && (
                    <CreateBugModal
                        projectId={id}
                        projectCode={project.project_code}
                        onSuccess={() => setRefreshTrigger(prev => prev + 1)}
                    />
                )}
            </div>

            {/* Board Container */}
            <div className="flex-1 min-h-0 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
                <KanbanBoard projectId={id} refreshTrigger={refreshTrigger} />
            </div>
        </div>
    )
}
