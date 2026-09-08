import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { extractOwnerAndRepo, getRepoDetails } from '@/lib/github'
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Github, Lock, KeyRound } from 'lucide-react'

const formSchema = z.object({
    name: z.string().min(2, 'Project name must be at least 2 characters.'),
    projectCode: z.string().min(2).max(5).toUpperCase().regex(/^[A-Z]+$/, "Only uppercase letters allowed."),
    githubUrl: z.string().url('Must be a valid GitHub URL.').includes('github.com', { message: 'Must be a github.com URL' }),
    githubPat: z.string().optional(),
})

export function CreateProjectModal({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [showPatField, setShowPatField] = useState(false)
    const { session, user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            projectCode: '',
            githubUrl: '',
            githubPat: '',
        },
    })

    const resolveToken = (pat?: string): string | undefined => {
        if (pat && pat.trim().length > 0) return pat.trim()
        if (session?.provider_token) return session.provider_token
        return undefined
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user || !session) return

        setLoading(true)
        try {
            const repoInfo = extractOwnerAndRepo(values.githubUrl)
            if (!repoInfo) throw new Error('Invalid GitHub repository URL format.')

            const token = resolveToken(values.githubPat)

            const details = await getRepoDetails(token, repoInfo.owner, repoInfo.repo)

            const { data: project, error: projectError } = await supabase
                .from('projects')
                .insert({
                    name: values.name,
                    project_code: values.projectCode,
                    github_repo_url: values.githubUrl,
                    github_owner: repoInfo.owner,
                    github_repo: repoInfo.repo,
                    github_details: details,
                    created_by: user.id
                })
                .select()
                .single()

            if (projectError) throw projectError

            const { error: memberError } = await supabase
                .from('project_members')
                .insert({
                    project_id: project.id,
                    user_id: user.id,
                    project_role: 'admin'
                })

            if (memberError) throw memberError

            const resolvedToken = resolveToken(values.githubPat)
            if (resolvedToken) {
                localStorage.setItem(`github_pat_${project.id}`, resolvedToken)
            }

            setOpen(false)
            form.reset()
            setShowPatField(false)
            onSuccess()
        } catch (error: any) {
            console.error(error)

            if (
                error?.code === '23505' ||
                (error?.message && error.message.includes('projects_project_code_key'))
            ) {
                form.setError('projectCode', {
                    message: 'This project code is already in use. Please choose a different code.',
                })
                return
            }

            if (error?.status === 404 || error?.message?.includes('Not Found')) {
                form.setError('githubUrl', {
                    message: 'Repository not found. If it is private, provide a GitHub Personal Access Token with "repo" scope.',
                })
                return
            }

            if (error?.status === 403) {
                form.setError('githubUrl', {
                    message: 'Access denied. Make sure your token has the "repo" scope and you are a collaborator on this repository.',
                })
                return
            }

            form.setError('githubUrl', { message: error.message || 'Failed to sync with GitHub.' })
        } finally {
            setLoading(false)
        }
    }

    const inputClasses = "w-full rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] hover:bg-[#EBECF0] focus:bg-white focus:border-[#4C9AFF] focus:ring-1 focus:ring-[#4C9AFF] transition-colors text-sm px-3 py-2 text-[#172B4D] placeholder:text-[#A5ADBA] focus-visible:ring-1 focus-visible:ring-offset-0 focus-visible:ring-[#4C9AFF]"

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setShowPatField(false) } }}>
            <DialogTrigger asChild>
                <button className="bg-[#0052CC] hover:bg-[#0047B3] text-white px-4 py-2 rounded-[3px] font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
                    Create Project
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] p-0 bg-white border-0 shadow-[0_8px_16px_-4px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)] rounded-[3px] gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="px-6 py-5 border-b border-[#DFE1E6] flex flex-row items-center justify-between flex-shrink-0">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D]">Create project</DialogTitle>
                </DialogHeader>

                <div className="overflow-y-auto flex-1 px-6 py-5">
                    <p className="text-[14px] text-[#5E6C84] mb-6">
                        Link a GitHub repository to start tracking bugs and SLA metrics automatically.
                    </p>

                    <Form {...form}>
                        <form id="create-project-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Project Name<span className="text-[#DE350B] ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <input placeholder="E.g. E-Commerce API" className={inputClasses} {...field} />
                                        </FormControl>
                                        <FormMessage className="text-[#DE350B] text-xs" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="projectCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">Project Key<span className="text-[#DE350B] ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <input placeholder="E.g. ECOM" className={inputClasses} {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                                        </FormControl>
                                        <FormDescription className="text-xs text-[#5E6C84]">Used as a prefix for issue IDs (e.g. ECOM-1)</FormDescription>
                                        <FormMessage className="text-[#DE350B] text-xs" />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="githubUrl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1">GitHub Repository URL<span className="text-[#DE350B] ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Github className="absolute left-3.5 top-2.5 h-4 w-4 text-[#A5ADBA]" />
                                                <input placeholder="https://github.com/owner/repo" className={`${inputClasses} pl-10`} {...field} />
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-[#DE350B] text-xs" />
                                    </FormItem>
                                )}
                            />

                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowPatField(v => !v)}
                                    className="flex items-center gap-1.5 text-xs text-[#5E6C84] hover:text-[#172B4D] hover:underline transition-colors mt-2"
                                >
                                    <Lock className="h-3 w-3" />
                                    {showPatField ? 'Hide token field' : 'Connect a private repository?'}
                                </button>

                                {showPatField && (
                                    <FormField
                                        control={form.control}
                                        name="githubPat"
                                        render={({ field }) => (
                                            <FormItem className="mt-3">
                                                <FormLabel className="text-[12px] font-semibold text-[#5E6C84] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                    <KeyRound className="h-3.5 w-3.5 text-[#FFAB00]" />
                                                    GitHub Personal Access Token
                                                </FormLabel>
                                                <FormControl>
                                                    <input
                                                        type="password"
                                                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                                        className={inputClasses}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs text-[#5E6C84] mt-1">
                                                    Required for private repos. Needs <code className="bg-[#FFFAE6] px-1 rounded text-[#FF8B00] border border-[#FFE380]">repo</code> scope. Token is used once and never stored.
                                                    {session?.provider_token && (
                                                        <span className="block mt-1 text-[#006644] font-medium">✓ Your GitHub OAuth token will be used automatically if this field is empty.</span>
                                                    )}
                                                </FormDescription>
                                                <FormMessage className="text-[#DE350B] text-xs" />
                                            </FormItem>
                                        )}
                                    />
                                )}
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
                        form="create-project-form"
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
