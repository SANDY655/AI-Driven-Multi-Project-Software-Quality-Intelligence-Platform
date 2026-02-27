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
import { Settings, Loader2 } from 'lucide-react'

interface EditProjectModalProps {
    project: {
        id: string
        name: string
        description: string
    }
    userRole?: string
    onSuccess: () => void
}

export function EditProjectModal({ project, userRole, onSuccess }: EditProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState(project.name)
    const [description, setDescription] = useState(project.description || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canEdit = ['admin', 'pm'].includes(userRole || '')

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canEdit) return

        setLoading(true)
        setError(null)

        try {
            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    name,
                    description,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project.id)

            if (updateError) throw updateError

            setOpen(false)
            onSuccess()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!canEdit) return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
                    <Settings className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Update the project name and description.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleUpdate} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Project Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400 uppercase tracking-widest">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="flex w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                            placeholder="Briefly describe the project..."
                        />
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
                                    Saving Changes...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
