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
import { UserPlus, Loader2 } from 'lucide-react'

interface InviteMemberModalProps {
    projectId: string
    onSuccess: () => void
}

export function InviteMemberModal({ projectId, onSuccess }: InviteMemberModalProps) {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [role, setRole] = useState('developer')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { user } = useAuth()

    const handleInvite = async (e: React.FormEvent) => {
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
                throw new Error('You do not have permission to invite members.')
            }
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email.trim().toLowerCase())
                .single()

            if (profileError || !profile) {
                throw new Error('User not found. They must sign up for the app first.')
            }

            const { error: inviteError } = await supabase
                .from('project_members')
                .insert({
                    project_id: projectId,
                    user_id: profile.id,
                    project_role: role
                })

            if (inviteError) {
                if (inviteError.code === '23505') {
                    throw new Error('This user is already a member of this project.')
                }
                throw new Error(inviteError.message)
            }

            const { data: project } = await supabase
                .from('projects')
                .select('name')
                .eq('id', projectId)
                .single()

            const { data: inviterProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user?.id)
                .single()

            try {
                await supabase.functions.invoke('send-invite-email', {
                    body: {
                        email: email.trim().toLowerCase(),
                        projectName: project?.name || 'your new project',
                        role,
                        inviterName: inviterProfile?.full_name || user?.email || 'A team member'
                    }
                })
            } catch (emailErr) {
                console.error('Failed to send invite email:', emailErr)
            }

            setOpen(false)
            setEmail('')
            setRole('developer')
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D] placeholder:text-[#A5ADBA] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4C9AFF]"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="bg-[#FAFBFC] hover:bg-[#EBECF0] text-[#42526E] border border-[#DFE1E6] px-3 py-1.5 rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2">
                    <UserPlus className="h-4 w-4" /> Add people
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">Add people</DialogTitle>
                </DialogHeader>

                <form id="invite-member-form" onSubmit={handleInvite} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Email Address<span className="text-[#DE350B] ml-1">*</span></label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g., maria@company.com"
                            className={inputClasses}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Role</label>
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
                        form="invite-member-form"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
