import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckSquare } from 'lucide-react'

const formSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters.'),
    description: z.string().min(1, 'Description is required.'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
})

interface CreateTaskModalProps {
    projectId: string
    projectCode: string
    onSuccess: () => void
}

export function CreateTaskModal({ projectId, projectCode, onSuccess }: CreateTaskModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            priority: 'medium',
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) return

        setLoading(true)
        try {
            // 1. Get the latest task_number for this project
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

            // 2. Insert the new task
            const { error: insertError } = await supabase
                .from('tasks')
                .insert({
                    project_id: projectId,
                    task_display_id: taskDisplayId,
                    task_number: nextTaskNumber,
                    title: values.title,
                    description: values.description,
                    priority: values.priority,
                    created_by: user.id
                })

            if (insertError) throw insertError

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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <CheckSquare className="h-4 w-4" />
                    Create Task
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-[24px] p-6 bg-white border-zinc-100 shadow-xl gap-5">
                <DialogHeader className="space-y-2 pb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">Create a New Task</DialogTitle>
                    <DialogDescription className="text-[15px] text-zinc-500">
                        Create a new task ticket for this project.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">Task Title</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="E.g. Update user profile schema"
                                            className="rounded-xl border-zinc-200 focus-visible:ring-zinc-900 h-11 text-base placeholder:text-zinc-400"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Provide detailed steps or description..."
                                            className="resize-none h-32 rounded-xl border-zinc-200 focus-visible:ring-zinc-900 text-base placeholder:text-zinc-400 p-4"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="priority"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">Priority</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="rounded-xl border-zinc-200 focus:ring-zinc-900 h-11 text-base">
                                                <SelectValue placeholder="Select priority" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border-zinc-100 shadow-lg">
                                            <SelectItem value="low" className="rounded-lg">Low</SelectItem>
                                            <SelectItem value="medium" className="rounded-lg">Medium</SelectItem>
                                            <SelectItem value="high" className="rounded-lg">High</SelectItem>
                                            <SelectItem value="urgent" className="rounded-lg">Urgent</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 mt-2">
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
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Task
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
