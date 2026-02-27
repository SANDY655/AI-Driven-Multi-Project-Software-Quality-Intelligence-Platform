import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Edit2, Loader2, Trash2 } from 'lucide-react'

interface EditMemberRoleModalProps {
    projectId: string
    memberId: string
    memberName: string
    currentRole: string
    onSuccess: () => void
}

export function EditMemberRoleModal({ projectId, memberId, memberName, currentRole, onSuccess }: EditMemberRoleModalProps) {
    const [open, setOpen] = useState(false)
    const [role, setRole] = useState(currentRole)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { user } = useAuth()

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // RBAC: Verify user permission
            const { data: userRole } = await supabase
                .from('project_members')
                .select('project_role')
                .eq('project_id', projectId)
                .eq('user_id', user?.id)
                .single()

            if (!userRole || !['admin', 'pm'].includes(userRole.project_role)) {
                throw new Error('You do not have permission to manage members.')
            }
            const { error: updateError } = await supabase
                .from('project_members')
                .update({ project_role: role })
                .match({ project_id: projectId, user_id: memberId })

            if (updateError) throw updateError

            setOpen(false)
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRemove = async () => {
        if (!confirm(`Are you sure you want to remove ${memberName} from this project?`)) return

        setLoading(true)
        setError(null)

        try {
            const { error: deleteError } = await supabase
                .from('project_members')
                .delete()
                .match({ project_id: projectId, user_id: memberId })

            if (deleteError) throw deleteError

            setOpen(false)
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-white transition-colors" title="Edit Role">
                    <Edit2 className="h-3 w-3" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Edit Member Role</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Change the project permissions for <strong>{memberName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Project Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="viewer">Viewer (Read-only)</option>
                            <option value="tester">Tester (Create Bugs)</option>
                            <option value="developer">Developer (Fix Bugs)</option>
                            <option value="pm">Project Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3 pt-4">
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Role'}
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleRemove}
                            disabled={loading}
                            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 w-full"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Member
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
