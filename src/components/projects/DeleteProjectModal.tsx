import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'

interface DeleteProjectModalProps {
    project: {
        name: string
    }
    onConfirm: () => Promise<void>
}

export function DeleteProjectModal({ project, onConfirm }: DeleteProjectModalProps) {
    const [open, setOpen] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const [loading, setLoading] = useState(false)

    const isMatch = confirmText === project.name

    const handleDelete = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isMatch) return

        setLoading(true)
        try {
            await onConfirm()
            // if successful, ProjectDashboard will unmount and navigate to /
            // if not, we stop loading
        } catch (err: any) {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(newOpen) => {
            setOpen(newOpen)
            if (!newOpen) {
                setConfirmText('')
            }
        }}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-zinc-200 text-zinc-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 gap-2 transition-all h-9"
                >
                    <Trash2 className="h-4 w-4" />
                    Delete Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white border-zinc-200 text-zinc-900 shadow-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-red-600">Delete Project</DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        This action is permanent and will remove all associated bugs, tasks, and members from this project.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleDelete} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-700">
                            Please type <span className="font-bold">{project.name}</span> to confirm.
                        </label>
                        <input
                            type="text"
                            required
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-red-500 shadow-sm transition-all"
                            placeholder={project.name}
                        />
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isMatch || loading}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
