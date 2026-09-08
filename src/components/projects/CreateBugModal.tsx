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
import { Loader2, Bug, Sparkles, AlertTriangle, ArrowUp, ArrowDown, Minus, ArrowRight } from 'lucide-react'

const formSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters.'),
    description: z.string().min(1, 'Description is required.'),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    priority: z.enum(['P0', 'P1', 'P2', 'P3']),
    assigned_to: z.string().optional().nullable(),
    duplicate_of: z.string().optional().nullable(),
    epic_id: z.string().optional().nullable(),
    story_points: z.coerce.number().min(0).max(100).optional(),
    labels: z.string().optional(),
    environment: z.string().optional(),
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
    const [epics, setEpics] = useState<any[]>([])
    const [aiDuplicates, setAiDuplicates] = useState<any[]>([])
    const [aiRationale, setAiRationale] = useState('')
    const [aiAssigneeRationale, setAiAssigneeRationale] = useState('')

    const { user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            severity: 'medium',
            priority: 'P2',
            assigned_to: null,
            duplicate_of: null,
            epic_id: null,
            story_points: 0,
            labels: '',
            environment: '',
        },
    })

    useEffect(() => {
        if (open) {
            setStep(1)
            form.reset({
                title: '',
                description: '',
                severity: 'medium',
                priority: 'P2',
                assigned_to: null,
                duplicate_of: null,
                epic_id: null,
                story_points: 0,
                labels: '',
                environment: '',
            })
            setAiDuplicates([])
            setAiRationale('')
            setAiAssigneeRationale('')

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

            const fetchEpics = async () => {
                const { data } = await supabase.from('epics').select('id, name').eq('project_id', projectId)
                if (data) setEpics(data)
            }
            fetchEpics()
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
                if (assigneeRec.recommendation.rationale) {
                    setAiAssigneeRationale(assigneeRec.recommendation.rationale)
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

            // Parse labels if needed, but since DB migration failed, we'll exclude labels/environment from the payload to avoid crashing
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
                    assigned_to: values.assigned_to && values.assigned_to !== 'none' ? values.assigned_to : null,
                    epic_id: values.epic_id && values.epic_id !== 'none' ? values.epic_id : null,
                    story_points: values.story_points || 0,
                    ai_predicted_severity: values.severity,
                    ai_suggested_assignee: values.assigned_to && values.assigned_to !== 'none' ? values.assigned_to : null,
                    duplicate_of: values.duplicate_of && values.duplicate_of !== 'none' ? values.duplicate_of : null,
                    status: values.duplicate_of && values.duplicate_of !== 'none' ? 'closed' : 'open'
                })
                .select()
                .single()

            if (insertError) throw insertError

            if (newBug && values.duplicate_of) {
                const { mergeDuplicateBug } = await import('@/lib/bug-actions')
                mergeDuplicateBug(newBug.id, bugDisplayId, values.duplicate_of, user.id)
                    .catch(e => console.error("Failed to merge duplicate activity", e))
            }

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

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D] placeholder:text-[#A5ADBA] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4C9AFF]"

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="bg-[#0052CC] hover:bg-[#0047B3] text-white px-3 py-1.5 rounded font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
                    Create Issue
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">
                        Create issue
                    </DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <Form {...form}>
                        <form id="create-bug-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                            <div className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Summary<span className="text-[#DE350B] ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <input
                                                    {...field}
                                                    placeholder="A concise summary of the issue"
                                                    className={inputClasses}
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
                                            <div className="relative">
                                                <FormControl>
                                                    <Textarea
                                                        {...field}
                                                        placeholder="Add a detailed description..."
                                                        className={`${inputClasses} min-h-[150px] resize-y`}
                                                    />
                                                </FormControl>
                                                {step === 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleAnalyze}
                                                        disabled={isAnalyzing}
                                                        className="absolute bottom-3 right-3 bg-[#EAE6FF] hover:bg-[#403294] text-[#403294] hover:text-white px-3 py-1.5 rounded-[3px] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
                                                    >
                                                        {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                                        {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                                                    </button>
                                                )}
                                            </div>
                                            <FormMessage className="text-[#DE350B] text-xs" />
                                        </FormItem>
                                    )}
                                />
                                
                                {step === 2 && (
                                    <div className="p-4 bg-[#EAE6FF] border border-[#DFE1E6] rounded text-[#172B4D] mb-4">
                                        <div className="flex items-center gap-2 font-semibold text-sm text-[#403294] mb-2">
                                            <Sparkles className="w-4 h-4" /> AI Analysis Complete
                                        </div>
                                        <p className="text-sm">{aiRationale}</p>
                                    </div>
                                )}

                                {aiDuplicates.length > 0 && (
                                    <div className="p-4 bg-[#FFFAE6] border border-[#FFAB00] rounded text-[#172B4D] mb-4">
                                        <div className="flex items-center gap-2 font-semibold text-sm text-[#FF8B00] mb-2">
                                            <AlertTriangle className="w-4 h-4" /> Potential Duplicates Detected
                                        </div>
                                        <ul className="text-sm list-disc pl-5">
                                            {aiDuplicates.map((dup: any, i: number) => (
                                                <li key={i}>{dup.bug_display_id}: {dup.title}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-6">
                                    <FormField
                                        control={form.control}
                                        name="priority"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Priority</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className={inputClasses}>
                                                            <SelectValue placeholder="Select priority" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                        <SelectItem value="P0"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#DE350B]" /> Highest (P0)</div></SelectItem>
                                                        <SelectItem value="P1"><div className="flex items-center gap-2"><ArrowUp className="w-4 h-4 text-[#FF5630]" /> High (P1)</div></SelectItem>
                                                        <SelectItem value="P2"><div className="flex items-center gap-2"><Minus className="w-4 h-4 text-[#FFAB00]" /> Medium (P2)</div></SelectItem>
                                                        <SelectItem value="P3"><div className="flex items-center gap-2"><ArrowDown className="w-4 h-4 text-[#0065FF]" /> Low (P3)</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="severity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Severity</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className={inputClasses}>
                                                            <SelectValue placeholder="Select severity" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                        <SelectItem value="critical">Critical</SelectItem>
                                                        <SelectItem value="high">High</SelectItem>
                                                        <SelectItem value="medium">Medium</SelectItem>
                                                        <SelectItem value="low">Low</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="assigned_to"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Assignee</FormLabel>
                                                <Select
                                                    onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                                                    defaultValue={field.value || "none"}
                                                    value={field.value || "none"}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className={inputClasses}>
                                                            <SelectValue placeholder="Automatic" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                        <SelectItem value="none">Automatic</SelectItem>
                                                        {projectMembers.map(member => (
                                                            <SelectItem key={member.id} value={member.id}>
                                                                {member.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {aiAssigneeRationale && (
                                                    <p className="text-xs text-[#0052CC] mt-1 italic">
                                                        AI suggests this assignee because: {aiAssigneeRationale}
                                                    </p>
                                                )}
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="epic_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Epic Link (Optional)</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value || "none"}>
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
                                        name="labels"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Labels</FormLabel>
                                                <FormControl>
                                                    <input
                                                        {...field}
                                                        placeholder="e.g. frontend, urgent, ui"
                                                        className={inputClasses}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="environment"
                                        render={({ field }) => (
                                            <FormItem className="col-span-2">
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Environment</FormLabel>
                                                <FormControl>
                                                    <input
                                                        {...field}
                                                        placeholder="e.g. Production, Staging, Windows 10, Chrome 91"
                                                        className={inputClasses}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {aiDuplicates.length > 0 && (
                                        <FormField
                                            control={form.control}
                                            name="duplicate_of"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Link as duplicate of</FormLabel>
                                                    <Select
                                                        onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                                                        defaultValue={field.value || "none"}
                                                        value={field.value || "none"}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className={inputClasses}>
                                                                <SelectValue placeholder="Not a duplicate" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-white border-[#DFE1E6] shadow-md rounded-[3px]">
                                                            <SelectItem value="none">Not a duplicate</SelectItem>
                                                            {aiDuplicates.map(dup => (
                                                                <SelectItem key={dup.id} value={dup.id}>
                                                                    {dup.bug_display_id} - {dup.title}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )}
                                        />
                                    )}
                                </div>
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
                        form="create-bug-form"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0052CC] hover:bg-[#0047B3] text-white rounded-[3px] font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Create
                    </button>
                </div>

            </DialogContent>
        </Dialog>
    )
}
