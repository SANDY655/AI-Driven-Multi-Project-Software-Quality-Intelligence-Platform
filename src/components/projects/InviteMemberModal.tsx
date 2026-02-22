import { useState } from 'react'
import { supabase } from '@/lib/supabase'
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

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
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

            // Success
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
                <Button size="sm" variant="outline" className="gap-2 text-zinc-300 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:text-white">
                    <UserPlus className="h-4 w-4" />
                    Invite
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Invite a Team Member</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Add an existing user to this project. They must have an account.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleInvite} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">User Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Project Role</label>
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

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending Invite...
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
