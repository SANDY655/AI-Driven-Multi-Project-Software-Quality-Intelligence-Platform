import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { X, GitBranch, Loader2, CheckCircle2 } from 'lucide-react'
import { getGitHubClient } from '@/lib/github'
import { supabase } from '@/lib/supabase'

interface CreateBranchModalProps {
    projectId: string
    issueId: string
    issueDisplayId: string
    issueTitle: string
    isTask: boolean
    githubToken: string
    githubOwner: string
    githubRepo: string
    onClose: () => void
    onSuccess: () => void
}

export function CreateBranchModal({
    projectId,
    issueId,
    issueDisplayId,
    issueTitle,
    isTask,
    githubToken,
    githubOwner,
    githubRepo,
    onClose,
    onSuccess
}: CreateBranchModalProps) {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [branches, setBranches] = useState<string[]>([])
    
    // Form state
    const [baseBranch, setBaseBranch] = useState('main')
    const [branchType, setBranchType] = useState(isTask ? 'feature' : 'bugfix')
    
    // Generate safe branch name
    const safeTitle = issueTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const [branchName, setBranchName] = useState(`${issueDisplayId}-${safeTitle}`)
    
    useEffect(() => {
        async function fetchBranches() {
            try {
                const octokit = getGitHubClient(githubToken)
                const { data } = await octokit.rest.repos.listBranches({
                    owner: githubOwner,
                    repo: githubRepo,
                    per_page: 100
                })
                const branchNames = data.map(b => b.name)
                setBranches(branchNames)
                if (branchNames.includes('main')) setBaseBranch('main')
                else if (branchNames.includes('master')) setBaseBranch('master')
                else if (branchNames.length > 0) setBaseBranch(branchNames[0])
            } catch (e: any) {
                console.error(e)
                setError('Failed to fetch branches. Check your token permissions.')
            } finally {
                setLoading(false)
            }
        }
        fetchBranches()
    }, [githubToken, githubOwner, githubRepo])

    const handleCreate = async () => {
        if (!branchName.trim()) {
            setError('Branch name is required')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const octokit = getGitHubClient(githubToken)
            const fullBranchName = branchType === 'custom' ? branchName.trim() : `${branchType}/${branchName.trim()}`

            // 1. Get base branch SHA
            const baseRef = await octokit.rest.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${baseBranch}`
            })

            // 2. Create new branch
            await octokit.rest.git.createRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `refs/heads/${fullBranchName}`,
                sha: baseRef.data.object.sha
            })

            // 3. Save to our database
            const { data: dbBranch, error: insertError } = await supabase
                .from('branches')
                .insert({
                    project_id: projectId,
                    name: fullBranchName,
                    url: `https://github.com/${githubOwner}/${githubRepo}/tree/${fullBranchName}`
                })
                .select()
                .single()

            if (insertError) throw insertError

            // 4. Link to issue
            if (isTask) {
                await supabase.from('branch_task_links').insert({ branch_id: dbBranch.id, task_id: issueId })
            } else {
                await supabase.from('branch_bug_links').insert({ branch_id: dbBranch.id, bug_id: issueId })
            }

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 2000)
        } catch (e: any) {
            console.error(e)
            setError(e.message || 'Failed to create branch')
        } finally {
            setSubmitting(false)
        }
    }

    const selectClasses = "w-full border border-[#DFE1E6] rounded-[3px] px-3 py-1.5 text-sm focus:outline-none focus:border-[#4C9AFF] transition-colors bg-[#FAFBFC] hover:bg-[#EBECF0] cursor-pointer appearance-none"
    const inputClasses = "w-full border border-[#DFE1E6] rounded-[3px] px-3 py-1.5 text-sm focus:outline-none focus:border-[#4C9AFF] transition-colors"

    if (success) {
        const fullBranchName = branchType === 'custom' ? branchName.trim() : `${branchType}/${branchName.trim()}`
        return (
            <Dialog open={true} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[500px] p-8 bg-white flex flex-col items-center justify-center text-center border-none" showCloseButton={false}>
                    <DialogTitle className="sr-only">Branch Created Successfully</DialogTitle>
                    <CheckCircle2 className="w-16 h-16 text-[#006644] mb-4" />
                    <h2 className="text-xl font-medium text-[#172B4D] mb-2">Branch Created</h2>
                    <p className="text-sm text-[#5E6C84] mb-6">
                        Branch <strong>{fullBranchName}</strong> was successfully created in GitHub.
                    </p>
                    <div className="w-full bg-[#FAFBFC] border border-[#DFE1E6] p-3 rounded-[3px] text-left">
                        <p className="text-[11px] font-bold text-[#5E6C84] uppercase mb-1">Checkout Command</p>
                        <code className="text-sm text-[#172B4D] select-all">
                            git fetch && git checkout {fullBranchName}
                        </code>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[600px] p-0 bg-white gap-0 rounded-[3px] shadow-lg border-none" showCloseButton={false}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE1E6]">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D] flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-[#172B4D]" />
                        Create Branch
                    </DialogTitle>
                    <button onClick={onClose} className="text-[#5E6C84] hover:bg-[#EBECF0] p-1.5 rounded-[3px] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 text-[#0052CC] animate-spin mb-4" />
                            <p className="text-sm text-[#5E6C84]">Loading repository data...</p>
                        </div>
                    ) : error && !branches.length ? (
                        <div className="p-4 bg-[#FFEBE6] text-[#DE350B] rounded-[3px] text-sm">
                            {error}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-1 space-y-1">
                                    <label className="text-[12px] font-semibold text-[#5E6C84]">Repository</label>
                                    <div className="w-full border border-[#DFE1E6] rounded-[3px] px-3 py-1.5 text-sm bg-[#EBECF0] text-[#5E6C84] cursor-not-allowed">
                                        {githubOwner}/{githubRepo}
                                    </div>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-[12px] font-semibold text-[#5E6C84]">Base branch</label>
                                    <select 
                                        value={baseBranch} 
                                        onChange={e => setBaseBranch(e.target.value)}
                                        className={selectClasses}
                                    >
                                        {branches.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[12px] font-semibold text-[#5E6C84]">Branch Name</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={branchType} 
                                        onChange={e => setBranchType(e.target.value)}
                                        className={`${selectClasses} w-[140px] shrink-0`}
                                    >
                                        <option value="feature">feature/</option>
                                        <option value="bugfix">bugfix/</option>
                                        <option value="hotfix">hotfix/</option>
                                        <option value="custom">custom</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={branchName}
                                        onChange={(e) => setBranchName(e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>

                            {error && <p className="text-[#DE350B] text-xs">{error}</p>}
                        </>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-[#DFE1E6] flex justify-end gap-2 bg-[#FAFBFC] rounded-b-[3px]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] rounded-[3px] transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleCreate} 
                        disabled={loading || submitting}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-[#0052CC] hover:bg-[#0047B3] rounded-[3px] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Create branch
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
