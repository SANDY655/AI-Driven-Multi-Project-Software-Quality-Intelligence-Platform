import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { X, GitCommit, CheckSquare, Copy } from 'lucide-react'

interface CreateCommitModalProps {
    issueDisplayId: string
    onClose: () => void
}

export function CreateCommitModal({ issueDisplayId, onClose }: CreateCommitModalProps) {
    const [copied, setCopied] = useState(false)

    const commitMessage = `git commit -m "${issueDisplayId}: "`

    const handleCopy = () => {
        navigator.clipboard.writeText(commitMessage)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] p-0 bg-white gap-0 rounded-[3px] shadow-lg border-none" showCloseButton={false}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DFE1E6]">
                    <DialogTitle className="text-[20px] font-medium text-[#172B4D] flex items-center gap-2">
                        <GitCommit className="w-5 h-5 text-[#172B4D]" />
                        Create Commit
                    </DialogTitle>
                    <button onClick={onClose} className="text-[#5E6C84] hover:bg-[#EBECF0] p-1.5 rounded-[3px] transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <DialogDescription className="text-sm text-[#172B4D]">
                        To automatically link your commits to <strong>{issueDisplayId}</strong>, you need to include the issue key in your commit message. Our GitHub webhook will automatically detect it.
                    </DialogDescription>
                    
                    <div className="bg-[#FAFBFC] border border-[#DFE1E6] p-4 rounded-[3px] space-y-3">
                        <p className="text-[11px] font-bold text-[#5E6C84] uppercase tracking-wider">Example Command</p>
                        <div className="flex items-center justify-between bg-white border border-[#DFE1E6] p-2 rounded-[3px]">
                            <code className="text-sm text-[#172B4D] select-all font-mono">
                                {commitMessage}
                            </code>
                            <button 
                                onClick={handleCopy}
                                className="p-1.5 text-[#5E6C84] hover:bg-[#EBECF0] rounded transition-colors flex-shrink-0"
                                title="Copy to clipboard"
                            >
                                {copied ? <CheckSquare className="w-4 h-4 text-[#006644]" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="text-xs text-[#5E6C84] space-y-1">
                        <p><strong>Note:</strong> Commits are synced automatically when you push them to the connected repository.</p>
                        <p>They will appear under the "Commits" section in the Development panel.</p>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-[#DFE1E6] flex justify-end bg-[#FAFBFC] rounded-b-[3px]">
                    <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] rounded-[3px] transition-colors">
                        Close
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
