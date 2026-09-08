import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckSquare, ArrowUp, ArrowDown, Minus, ArrowRight } from 'lucide-react'

const formSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters.'),
    description: z.string().min(1, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    sprint_id: z.string().optional(),
    parent_id: z.string().optional(),
    epic_id: z.string().optional(),
    story_points: z.coerce.number().min(0).max(100).optional(),
    labels: z.string().optional(),
})

interface CreateTaskModalProps {
    projectId: string
    projectCode: string
    onSuccess: () => void
}

export function CreateTaskModal({ projectId, projectCode, onSuccess }: CreateTaskModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [sprints, setSprints] = useState<any[]>([])
    const [parentTasks, setParentTasks] = useState<any[]>([])
    const [epics, setEpics] = useState<any[]>([])
    const { user } = useAuth()

    useEffect(() => {
        if (open) {
            supabase.from('sprints').select('id, name').eq('project_id', projectId).eq('status', 'active').then(({ data }) => {
                if (data) setSprints(data)
            })
            supabase.from('tasks').select('id, title, task_display_id').eq('project_id', projectId).is('parent_id', null).then(({ data }) => {
                if (data) setParentTasks(data)
            })
            supabase.from('epics').select('id, name').eq('project_id', projectId).then(({ data }) => {
                if (data) setEpics(data)
            }).catch(() => {})
        }
    }, [open, projectId])

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            priority: 'medium',
            sprint_id: '',
            parent_id: '',
            epic_id: '',
            story_points: 0,
            labels: '',
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) return

        setLoading(true)
        try {
            const { data: latestTask, error: countError } = await supabase
                .from('tasks')
                .select('task_number')
                .eq('project_id', projectId)
                .order('task_number', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (countError) throw countError

            const nextTaskNumber = (latestTask?.task_number || 0) + 1
            const taskDisplayId = `${projectCode}-T${nextTaskNumber}`

            const { error: insertError } = await supabase
                .from('tasks')
                .insert({
                    project_id: projectId,
                    task_display_id: taskDisplayId,
                    task_number: nextTaskNumber,
                    title: values.title,
                    description: values.description,
                    priority: values.priority,
                    created_by: user.id,
                    sprint_id: values.sprint_id && values.sprint_id !== 'none' ? values.sprint_id : null,
                    parent_id: values.parent_id && values.parent_id !== 'none' ? values.parent_id : null,
                    epic_id: values.epic_id && values.epic_id !== 'none' ? values.epic_id : null,
                    story_points: values.story_points || 0
                })

            if (insertError) throw insertError
            
            const newTaskId = insertError ? null : (await supabase.from('tasks').select('id').eq('task_display_id', taskDisplayId).single()).data?.id
            
            if (newTaskId) {
                try {
                    await fetch('http://localhost:8000/api/embed-task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task_id: newTaskId,
                            title: values.title,
                            description: values.description
                        })
                    })
                } catch (embedError) {
                    console.error("Failed to generate task embedding", embedError)
                }
            }

            setOpen(false)
            form.reset()
            onSuccess()
        } catch (error: any) {
            console.error(error)
            form.setError('title', { message: error.message || 'Failed to create task.' })
        } finally {
            setLoading(false)
        }
    }

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D] placeholder:text-[#A5ADBA] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4C9AFF]"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="bg-[#0052CC] hover:bg-[#0047B3] text-white px-3 py-1.5 rounded font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" /> Create Task
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">Create issue</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <Form {...form}>
                        <form id="create-task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Summary<span className="text-[#DE350B] ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <input
                                                placeholder="A concise summary of the issue"
                                                className={inputClasses}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[#DE350B] text-xs" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Description</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Provide detailed steps or description..."
                                                className={`${inputClasses} min-h-[150px] resize-y`}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[#DE350B] text-xs" />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Priority</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={inputClasses}>
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                    <SelectItem value="urgent"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#DE350B]" /> Highest (Urgent)</div></SelectItem>
                                                    <SelectItem value="high"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#FF5630]" /> High</div></SelectItem>
                                                    <SelectItem value="medium"><div className="flex items-center gap-2"><Minus className="w-4 h-4 text-[#FFAB00]" /> Medium</div></SelectItem>
                                                    <SelectItem value="low"><div className="flex items-center gap-2"><ArrowDown className="w-4 h-4 text-[#0065FF]" /> Low</div></SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[#DE350B] text-xs" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="labels"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Labels</FormLabel>
                                            <FormControl>
                                                <input
                                                    {...field}
                                                    placeholder="e.g. backend, database, refactor"
                                                    className={inputClasses}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="sprint_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Sprint (Optional)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={inputClasses}>
                                                        <SelectValue placeholder="None" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                    <SelectItem value="none">None</SelectItem>
                                                    {sprints.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[#DE350B] text-xs" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="epic_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Epic Link (Optional)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={inputClasses}>
                                                        <SelectValue placeholder="None" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                    <SelectItem value="none">None</SelectItem>
                                                    {epics.map(e => (
                                                        <SelectItem key={e.id} value={e.id}>
                                                            {e.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[#DE350B] text-xs" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="story_points"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Story Points</FormLabel>
                                            <FormControl>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    {...field}
                                                    className={inputClasses}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="parent_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Parent Task (Optional)</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className={inputClasses}>
                                                        <SelectValue placeholder="None" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                    <SelectItem value="none">None</SelectItem>
                                                    {parentTasks.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>
                                                            <span className="font-mono text-[#5E6C84] mr-2">{t.task_display_id}</span>
                                                            {t.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-[#DE350B] text-xs" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                        </form>
                    </Form>
                </div>

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
                        form="create-task-form"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
