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
import { Loader2, Plus, Github } from 'lucide-react'

const formSchema = z.object({
    name: z.string().min(2, 'Project name must be at least 2 characters.'),
    projectCode: z.string().min(2).max(5).toUpperCase().regex(/^[A-Z]+$/, "Only uppercase letters allowed."),
    githubUrl: z.string().url('Must be a valid GitHub URL.').includes('github.com', { message: 'Must be a github.com URL' }),
})

export function CreateProjectModal({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const { session, user } = useAuth()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            projectCode: '',
            githubUrl: '',
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user || !session) return

        setLoading(true)
        try {
            // 1. Validate GitHub URL
            const repoInfo = extractOwnerAndRepo(values.githubUrl)
            if (!repoInfo) throw new Error('Invalid GitHub repository URL format.')

            // We need the provider_token from the session to call the GitHub API
            // Note: If they logged in with email, provider_token will be missing. 
            // For now, we assume they logged in with GitHub as per the flow.
            const providerToken = session.provider_token
            if (!providerToken) {
                throw new Error('No GitHub access token found. Did you log in with GitHub?')
            }

            // 2. Fetch repo details from GitHub
            const details = await getRepoDetails(providerToken, repoInfo.owner, repoInfo.repo)

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

            // Success!
            setOpen(false)
            form.reset()
            onSuccess()
        } catch (error: any) {
            console.error(error)
            form.setError('githubUrl', { message: error.message || 'Failed to sync with GitHub.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                        Link a GitHub repository to start tracking bugs and SLA metrics automatically.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g. E-Commerce API" {...field} />
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
                                    <FormLabel>Project Code</FormLabel>
                                    <FormControl>
                                        <Input placeholder="E.g. ECOM" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                                    </FormControl>
                                    <FormDescription>Used as a prefix for bug IDs (e.g. BUG-ECOM-1)</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="githubUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>GitHub Repository URL</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Github className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                                            <Input placeholder="https://github.com/owner/repo" className="pl-9" {...field} />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={loading}>
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
