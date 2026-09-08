import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Dialog,
    DialogContent,
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

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D] placeholder:text-[#A5ADBA] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4C9AFF]"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="h-8 w-8 flex items-center justify-center text-[#5E6C84] hover:text-[#172B4D] hover:bg-[#EBECF0] rounded-[3px] transition-colors">
                    <Settings className="h-4 w-4" />
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col">
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">Project settings</DialogTitle>
                </DialogHeader>

                <form id="edit-project-form" onSubmit={handleUpdate} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                    <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Project Name<span className="text-[#DE350B] ml-1">*</span></label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClasses}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className={`${inputClasses} resize-none min-h-[100px]`}
                            placeholder="Briefly describe the project..."
                        />
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
                        form="edit-project-form"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Save
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
