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
import { Loader2, Bug } from 'lucide-react'

const formSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters.'),
    description: z.string().min(1, 'Description is required.'),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']),
})

interface CreateBugModalProps {
    projectId: string
    projectCode: string
    onSuccess: () => void
}

export function CreateBugModal({ projectId, projectCode, onSuccess }: CreateBugModalProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            severity: 'medium',
            priority: 'P2',
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user) return

        setLoading(true)
        try {
            // 1. Get the latest bug_number for this project
            const { data: latestBug, error: countError } = await supabase
                .from('bugs')
                .select('bug_number')
                .eq('project_id', projectId)
                .order('bug_number', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (countError) throw countError

            const nextBugNumber = (latestBug?.bug_number || 0) + 1
            const bugDisplayId = `${projectCode}-${nextBugNumber}`

            // 2. Insert the new bug
            const { error: insertError } = await supabase
                .from('bugs')
                .insert({
                    project_id: projectId,
                    bug_display_id: bugDisplayId,
                    bug_number: nextBugNumber,
                    title: values.title,
                    description: values.description,
                    severity: values.severity,
                    priority: values.priority,
                    reported_by: user.id
                })

            if (insertError) throw insertError

            setOpen(false)
            form.reset()
            onSuccess()
        } catch (error: any) {
            console.error(error)
            form.setError('title', { message: error.message || 'Failed to create bug.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                    <Bug className="h-4 w-4" />
                    Report Bug
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Report a New Bug</DialogTitle>
                    <DialogDescription>
                        Create a new issue ticket for this project.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bug Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g. Login page crashes on retry" {...field} />
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
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Provide detailed steps or description..." className="resize-none h-24" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="severity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Severity</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select severity" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="critical">Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select priority" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="P3">P3 - Low</SelectItem>
                                                <SelectItem value="P2">P2 - Medium</SelectItem>
                                                <SelectItem value="P1">P1 - High</SelectItem>
                                                <SelectItem value="P0">P0 - Critical</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Bug
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
