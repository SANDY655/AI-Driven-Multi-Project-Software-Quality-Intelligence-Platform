import { useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { aiClient } from '@/lib/ai-client'
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
import { Loader2, Bug, Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react'

const formSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters.'),
    description: z.string().min(1, 'Description is required.'),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']),
    assigned_to: z.string().optional().nullable(),
})

interface CreateBugModalProps {
    projectId: string
    projectCode: string
    onSuccess: () => void
}

export function CreateBugModal({ projectId, projectCode, onSuccess }: CreateBugModalProps) {
    const [open, setOpen] = useState(false)
    const [step, setStep] = useState<1 | 2>(1)
    const [loading, setLoading] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [projectMembers, setProjectMembers] = useState<{ id: string, name: string }[]>([])
    const [aiDuplicates, setAiDuplicates] = useState<any[]>([])
    const [aiRationale, setAiRationale] = useState('')
    
    const { user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            severity: 'medium',
            priority: 'P2',
            assigned_to: null
        },
    })

    useEffect(() => {
        if (open) {
            setStep(1)
            form.reset()
            setAiDuplicates([])
            setAiRationale('')
            
            const fetchMembers = async () => {
                const { data } = await supabase
                    .from('project_members')
                    .select('user_id, profiles(display_name)')
                    .eq('project_id', projectId)
                
                if (data) {
                    setProjectMembers(data.map(d => ({
                        id: d.user_id,
                        name: (d.profiles as any)?.display_name || 'Unknown User'
                    })))
                }
            }
            fetchMembers()
        }
    }, [open, projectId, form])

    const handleAnalyze = async () => {
        const title = form.getValues('title')
        const description = form.getValues('description')
        
        const isTitleValid = await form.trigger('title')
        const isDescValid = await form.trigger('description')
        
        if (!isTitleValid || !isDescValid) {
            return
        }

        setIsAnalyzing(true)
        try {
            const req = { title, description, project_id: projectId }
            
            const [analysis, assigneeRec, duplicateCheck] = await Promise.all([
                aiClient.analyzeBug(req).catch(e => { console.error(e); return null; }),
                aiClient.recommendAssignee(req).catch(e => { console.error(e); return null; }),
                aiClient.detectDuplicates(req).catch(e => { console.error(e); return null; })
            ])

            if (analysis?.prediction) {
                form.setValue('priority', analysis.prediction.priority)
                form.setValue('severity', analysis.prediction.severity)
                setAiRationale(analysis.prediction.rationale)
            }

            if (assigneeRec?.recommendation?.recommended_developer_id) {
                const recId = assigneeRec.recommendation.recommended_developer_id
                if (recId !== '00000000-0000-0000-0000-000000000000') {
                    form.setValue('assigned_to', recId)
                }
            }

            if (duplicateCheck?.duplicates && duplicateCheck.duplicates.length > 0) {
                setAiDuplicates(duplicateCheck.duplicates)
            }

            setStep(2)
        } catch (error) {
            console.error("AI Analysis failed", error)
            setStep(2)
        } finally {
            setIsAnalyzing(false)
        }
    }

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
            const { data: newBug, error: insertError } = await supabase
                .from('bugs')
                .insert({
                    project_id: projectId,
                    bug_display_id: bugDisplayId,
                    bug_number: nextBugNumber,
                    title: values.title,
                    description: values.description,
                    severity: values.severity,
                    priority: values.priority,
                    reported_by: user.id,
                    assigned_to: values.assigned_to || null,
                    ai_predicted_severity: values.severity,
                    ai_suggested_assignee: values.assigned_to || null
                })
                .select()
                .single()

            if (insertError) throw insertError

            // 3. Trigger Embedding
            if (newBug) {
                aiClient.embedBug(newBug.id, {
                    title: values.title,
                    description: values.description,
                    project_id: projectId
                }).catch(e => console.error("Failed to embed bug", e))
            }

            setOpen(false)
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
                <Button className="gap-2 bg-red-600 hover:bg-red-700 text-white shadow-md transition-all hover:scale-[1.02]">
                    <Bug className="h-4 w-4" />
                    Report Bug
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] rounded-[24px] p-6 bg-white border-zinc-100 shadow-xl gap-5">
                <DialogHeader className="space-y-2 pb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">
                        {step === 1 ? 'Report a New Bug' : 'Review & Submit Bug'}
                    </DialogTitle>
                    <DialogDescription className="text-[15px] text-zinc-500">
                        {step === 1 
                            ? 'Provide the details of the issue. Our AI will analyze it to suggest priority and severity.' 
                            : 'Review the AI suggestions. Modify them if needed before submitting.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        
                        <div className={step === 1 ? 'block' : 'hidden'}>
                            <div className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold text-zinc-900">Bug Title</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="E.g. Login page crashes on retry"
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
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100 mt-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    className="rounded-xl h-10 px-6 font-semibold border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="rounded-xl h-10 px-8 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-md gap-2 transition-all"
                                >
                                    {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                    Analyze with AI
                                </Button>
                            </div>
                        </div>

                        <div className={step === 2 ? 'block' : 'hidden'}>
                            {aiDuplicates.length > 0 && (
                                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                                    <div className="flex items-center gap-2 font-semibold">
                                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                                        Potential Duplicates Detected
                                    </div>
                                    <ul className="text-sm space-y-1 list-disc pl-6">
                                        {aiDuplicates.map((dup: any, i: number) => (
                                            <li key={i} className="text-amber-800">
                                                <span className="font-medium">{dup.title}</span> ({dup.priority}, {dup.severity})
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {aiRationale && (
                                <div className="mb-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 text-sm flex gap-3">
                                    <Sparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold mb-1 text-indigo-900">AI Analysis</p>
                                        <p className="text-indigo-800 leading-relaxed">{aiRationale}</p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="severity"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-sm font-semibold text-zinc-900">Severity</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="rounded-xl border-zinc-200 focus:ring-zinc-900 h-11 text-base">
                                                        <SelectValue placeholder="Select severity" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-zinc-100 shadow-lg">
                                                    <SelectItem value="low" className="rounded-lg">Low</SelectItem>
                                                    <SelectItem value="medium" className="rounded-lg">Medium</SelectItem>
                                                    <SelectItem value="high" className="rounded-lg">High</SelectItem>
                                                    <SelectItem value="critical" className="rounded-lg">Critical</SelectItem>
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
                                            <FormLabel className="text-sm font-semibold text-zinc-900">Priority</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="rounded-xl border-zinc-200 focus:ring-zinc-900 h-11 text-base">
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-zinc-100 shadow-lg">
                                                    <SelectItem value="P3" className="rounded-lg">P3 - Low</SelectItem>
                                                    <SelectItem value="P2" className="rounded-lg">P2 - Medium</SelectItem>
                                                    <SelectItem value="P1" className="rounded-lg">P1 - High</SelectItem>
                                                    <SelectItem value="P0" className="rounded-lg">P0 - Critical</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="assigned_to"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                                                Assignee
                                            </FormLabel>
                                            <Select 
                                                onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                                                defaultValue={field.value || "none"}
                                                value={field.value || "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="rounded-xl border-zinc-200 focus:ring-zinc-900 h-11 text-base">
                                                        <SelectValue placeholder="Select a developer (optional)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-zinc-100 shadow-lg">
                                                    <SelectItem value="none" className="rounded-lg italic text-zinc-500">Unassigned</SelectItem>
                                                    {projectMembers.map(member => (
                                                        <SelectItem key={member.id} value={member.id} className="rounded-lg">
                                                            {member.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="pt-4 flex justify-between items-center border-t border-zinc-100 mt-6">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setStep(1)}
                                    className="rounded-xl h-10 px-4 font-semibold text-zinc-600 hover:bg-zinc-100 gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <div className="flex gap-3">
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
                                        className="rounded-xl h-10 px-8 font-semibold bg-zinc-900 text-white hover:bg-zinc-800 shadow-md"
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Submit Bug
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
