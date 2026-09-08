import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
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

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D]"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center text-[#5E6C84] hover:text-[#172B4D] hover:bg-[#EBECF0] rounded-[3px] transition-colors" title="Edit Role">
                    <Edit2 className="h-4 w-4" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">Edit member role</DialogTitle>
                </DialogHeader>

                <form id="edit-member-form" onSubmit={handleUpdate} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    <div className="text-[14px] text-[#172B4D] mb-4">
                        Change the project permissions for <strong>{memberName}</strong>.
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Project Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className={inputClasses}
                        >
                            <option value="viewer">Viewer</option>
                            <option value="tester">Tester</option>
                            <option value="developer">Developer</option>
                            <option value="pm">Project Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 bg-[#FFEBE6] border border-[#DE350B] text-[#DE350B] text-sm rounded-[3px]">
                            {error}
                        </div>
                    )}
                    
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={loading}
                        className="mt-4 flex items-center text-[#DE350B] hover:underline text-sm font-medium"
                    >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Remove Member
                    </button>
                </form>

                <div className="px-6 py-4 border-t border-[#DFE1E6] bg-[#FAFBFC] flex justify-end gap-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 text-[#42526E] hover:bg-[#EBECF0] rounded-[3px] font-medium text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-member-form"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Update
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
