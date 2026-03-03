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
            // RBAC: Verify user permission
            const { data: userRole } = await supabase
                .from('project_members')
                .select('project_role')
                .eq('project_id', projectId)
                .eq('user_id', user?.id)
                .single()

            if (!userRole || !['admin', 'pm'].includes(userRole.project_role)) {
                throw new Error('You do not have permission to invite members.')
            }
            // 1. Find the user by their email in the profiles table
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email.trim().toLowerCase())
                .single()

            if (profileError || !profile) {
                throw new Error('User not found. They must sign up for the app first.')
            }

            // 2. Insert into project_members
            const { error: inviteError } = await supabase
                .from('project_members')
                .insert({
                    project_id: projectId,
                    user_id: profile.id,
                    project_role: role
                })

            if (inviteError) {
                if (inviteError.code === '23505') { // Unique violation
                    throw new Error('This user is already a member of this project.')
                }
                throw new Error(inviteError.message)
            }

            // Success - member added

            // Fetch additional details for the email
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

            // Try to send the invitation email, but don't fail the whole process if it errors
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
                // We don't throw an error here because the user was already successfully added
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2 text-zinc-600 border-zinc-200 bg-white hover:bg-zinc-50 hover:text-zinc-900 shadow-sm transition-all h-9">
                    <UserPlus className="h-4 w-4" />
                    Invite
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[24px] p-6 bg-white border-zinc-100 shadow-xl gap-5">
                <DialogHeader className="space-y-2 pb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">Invite a Team Member</DialogTitle>
                    <DialogDescription className="text-[15px] text-zinc-500">
                        Add an existing user to this project. They must have an account.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleInvite} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-900">User Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-sm transition-shadow"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-zinc-900">Project Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 shadow-sm transition-shadow"
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

                    <div className="pt-2 flex justify-end gap-3 border-t border-zinc-100 mt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="rounded-xl h-10 px-6 font-semibold border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="rounded-xl h-10 px-8 font-semibold bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                'Add Member'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
