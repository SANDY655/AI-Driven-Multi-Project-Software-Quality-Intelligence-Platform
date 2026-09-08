import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, Github, Loader2, AlertCircle } from 'lucide-react'
import { getRepoDetails } from '@/lib/github'

interface ConnectGithubModalProps {
    projectId: string
    githubOwner: string
    githubRepo: string
    onClose: () => void
    onSuccess: (token: string) => void
}

export function ConnectGithubModal({ projectId, githubOwner, githubRepo, onClose, onSuccess }: ConnectGithubModalProps) {
    const [token, setToken] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = async () => {
        if (!token.trim()) {
            setError('Token cannot be empty')
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Validate the token by fetching the repo details
            await getRepoDetails(token.trim(), githubOwner, githubRepo)
            
            localStorage.setItem(`github_pat_${projectId}`, token.trim())
            onSuccess(token.trim())
            onClose()
        } catch (e: any) {
            console.error(e)
            setError('Failed to connect. Please check your token and ensure it has the correct permissions (repo scope) and that you have access to the repository.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] p-0 bg-white gap-0 rounded-[3px] shadow-lg border-none" showCloseButton={false}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE1E6]">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D] flex items-center gap-2">
                        <Github className="w-5 h-5 text-[#172B4D]" />
                        Connect to GitHub
                    </DialogTitle>
                    <button onClick={onClose} className="text-[#5E6C84] hover:bg-[#EBECF0] p-1.5 rounded-[3px] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <DialogDescription className="text-sm text-[#172B4D]">
                        To create branches and interact with the repository <strong>{githubOwner}/{githubRepo}</strong>, you need to provide a GitHub Personal Access Token (PAT).
                    </DialogDescription>
                    
                    <div className="bg-[#DEEBFF] p-4 rounded-[3px] text-sm text-[#0052CC] flex gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            <AlertCircle className="w-4 h-4 text-[#0052CC]" />
                        </div>
                        <div>
                            <strong>How to get a token:</strong>
                            <ol className="list-decimal list-inside mt-2 space-y-1">
                                <li>Go to GitHub Settings &gt; Developer settings &gt; Personal access tokens &gt; Tokens (classic)</li>
                                <li>Generate a new token (classic)</li>
                                <li>Select the <strong>repo</strong> scope</li>
                                <li>Copy the token and paste it below</li>
                            </ol>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[12px] font-semibold text-[#5E6C84]">Personal Access Token</label>
                        <input
                            type="password"
                            placeholder="ghp_..."
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full border border-[#DFE1E6] rounded-[3px] px-3 py-2 text-sm focus:outline-none focus:border-[#4C9AFF] transition-colors"
                        />
                        {error && <p className="text-[#DE350B] text-xs mt-1">{error}</p>}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-[#DFE1E6] flex justify-end gap-2 bg-[#FAFBFC] rounded-b-[3px]">
                    <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] rounded-[3px] transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleConnect} 
                        disabled={loading}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-[#0052CC] hover:bg-[#0047B3] rounded-[3px] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Connect GitHub
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
