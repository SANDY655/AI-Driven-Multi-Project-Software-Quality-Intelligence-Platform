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
    DialogDescription,
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

    // Token resolution: PAT field > OAuth provider_token > unauthenticated
    const resolveToken = (pat?: string): string | undefined => {
        if (pat && pat.trim().length > 0) return pat.trim()
        if (session?.provider_token) return session.provider_token
        return undefined
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user || !session) return

        setLoading(true)
        try {
            // 1. Validate GitHub URL
            const repoInfo = extractOwnerAndRepo(values.githubUrl)
            if (!repoInfo) throw new Error('Invalid GitHub repository URL format.')

            const token = resolveToken(values.githubPat)

            // 2. Fetch repo details from GitHub (token required for private repos)
            const details = await getRepoDetails(token, repoInfo.owner, repoInfo.repo)

            // 3. Insert project into Supabase
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

            // 4. Add the creator as an Admin in project_members
            const { error: memberError } = await supabase
                .from('project_members')
                .insert({
                    project_id: project.id,
                    user_id: user.id,
                    project_role: 'admin'
                })

            if (memberError) throw memberError

            // Save the token to localStorage so the dashboard can auto-fetch
            // collaborators and contributors without the user re-entering it.
            const resolvedToken = resolveToken(values.githubPat)
            if (resolvedToken) {
                localStorage.setItem(`github_pat_${project.id}`, resolvedToken)
            }

            // Success!
            setOpen(false)
            form.reset()
            setShowPatField(false)
            onSuccess()
        } catch (error: any) {
            console.error(error)

            // Duplicate project code constraint violation
            if (
                error?.code === '23505' ||
                (error?.message && error.message.includes('projects_project_code_key'))
            ) {
                form.setError('projectCode', {
                    message: 'This project code is already in use. Please choose a different code.',
                })
                return
            }

            // Private repo accessed without a token
            if (error?.status === 404 || error?.message?.includes('Not Found')) {
                form.setError('githubUrl', {
                    message: 'Repository not found. If it is private, provide a GitHub Personal Access Token with "repo" scope.',
                })
                return
            }

            // Forbidden — token exists but lacks access
            if (error?.status === 403) {
                form.setError('githubUrl', {
                    message: 'Access denied. Make sure your token has the "repo" scope and you are a collaborator on this repository.',
                })
                return
            }

            // Generic fallback
            form.setError('githubUrl', { message: error.message || 'Failed to sync with GitHub.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setShowPatField(false) } }}>
            <DialogTrigger asChild>
                <Button className="gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold h-11 px-6">
                    <Plus className="h-4 w-4" />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] rounded-[24px] p-6 bg-white border-zinc-100 shadow-xl gap-5">
                <DialogHeader className="space-y-2 pb-1">
                    <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900">Create New Project</DialogTitle>
                    <DialogDescription className="text-[15px] text-zinc-500">
                        Link a GitHub repository to start tracking bugs and SLA metrics automatically. Supports both public and private repositories.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">Project Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g. E-Commerce API" className="rounded-xl border-zinc-200 focus-visible:ring-zinc-900 h-11 text-base placeholder:text-zinc-400" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="projectCode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">Project Code</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g. ECOM" className="rounded-xl border-zinc-200 focus-visible:ring-zinc-900 h-11 text-base placeholder:text-zinc-400" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                                    </FormControl>
                                    <FormDescription className="text-xs text-zinc-500">Used as a prefix for bug IDs (e.g. BUG-ECOM-1)</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="githubUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-sm font-semibold text-zinc-900">GitHub Repository URL</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Github className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                                            <Input placeholder="https://github.com/owner/repo" className="pl-10 rounded-xl border-zinc-200 focus-visible:ring-zinc-900 h-11 text-base placeholder:text-zinc-400" {...field} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* PAT field toggle */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setShowPatField(v => !v)}
                                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
                            >
                                <Lock className="h-3 w-3" />
                                {showPatField ? 'Hide' : 'Private repo?'} {!showPatField && '— Add GitHub Token'}
                            </button>

                            {showPatField && (
                                <FormField
                                    control={form.control}
                                    name="githubPat"
                                    render={({ field }) => (
                                        <FormItem className="mt-3">
                                            <FormLabel className="flex items-center gap-1.5">
                                                <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                                                GitHub Personal Access Token
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="password"
                                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                                    className="rounded-xl border-zinc-200 focus-visible:ring-zinc-900 h-11 text-base placeholder:text-zinc-400"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription className="text-xs text-zinc-500">
                                                Required for private repos. Needs <code className="bg-amber-50 px-1 rounded text-amber-700 border border-amber-200">repo</code> scope. Token is used once and never stored.
                                                {session?.provider_token && (
                                                    <span className="block mt-1 text-emerald-600 font-medium">✓ Your GitHub OAuth token will be used automatically if this field is empty.</span>
                                                )}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

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
                                className="rounded-xl h-10 px-8 font-semibold bg-[#6345FF] text-white hover:bg-[#5235E8]"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create & Sync
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
