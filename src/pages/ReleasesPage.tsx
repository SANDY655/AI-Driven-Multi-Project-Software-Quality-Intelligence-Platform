import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { createOrGetGitHubRelease, extractOwnerAndRepo } from '../lib/github'
import { 
    Tag, 
    Plus, 
    Loader2, 
    Rocket, 
    ExternalLink,
    X,
    Search,
    Trash2,
    Github,
    Sparkles
} from 'lucide-react'

export function ReleasesPage() {
    const { id } = useParams<{ id: string }>()
    const [loading, setLoading] = useState(true)
    const [project, setProject] = useState<any>(null)
    const [releases, setReleases] = useState<any[]>([])
    const [issues, setIssues] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'unreleased' | 'released'>('unreleased')
    const [searchQuery, setSearchQuery] = useState('')

    // Create Release Modal
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [versionName, setVersionName] = useState('')
    const [description, setDescription] = useState('')
    const [releaseDate, setReleaseDate] = useState('')
    const [publishGithub, setPublishGithub] = useState(true)
    const [creating, setCreating] = useState(false)
    const [releasingId, setReleasingId] = useState<string | null>(null)
    const [statusMsg, setStatusMsg] = useState<string | null>(null)

    // GitHub Sync Modal
    const [syncModalRelease, setSyncModalRelease] = useState<any | null>(null)
    const [githubToken, setGithubToken] = useState('')
    const [repoUrlInput, setRepoUrlInput] = useState('')
    const [syncing, setSyncing] = useState(false)

    useEffect(() => {
        if (!id) return
        loadReleasesData()
    }, [id])

    async function loadReleasesData() {
        setLoading(true)
        const [pRes, tRes, bRes] = await Promise.all([
            supabase.from('projects').select('*').eq('id', id).single(),
            supabase.from('tasks').select('*').eq('project_id', id),
            supabase.from('bugs').select('*').eq('project_id', id)
        ])

        if (pRes.data) setProject(pRes.data)

        const allIssues = [
            ...(tRes.data || []).map(t => ({ ...t, type: 'task' })),
            ...(bRes.data || []).map(b => ({ ...b, type: 'bug' }))
        ]
        setIssues(allIssues)

        const savedKey = `project_releases_${id}`
        const saved = localStorage.getItem(savedKey)
        if (saved) {
            try {
                setReleases(JSON.parse(saved))
            } catch {
                setReleases(getDefaultReleases())
            }
        } else {
            const defaults = getDefaultReleases()
            setReleases(defaults)
            localStorage.setItem(savedKey, JSON.stringify(defaults))
        }

        setLoading(false)
    }

    function getDefaultReleases() {
        return [
            {
                id: 'rel-1',
                name: 'v1.0.0',
                description: 'Initial project setup, core dashboard, and bug tracking features.',
                status: 'released',
                releaseDate: '2026-08-15',
                releasedAt: '2026-08-15',
                githubUrl: null
            },
            {
                id: 'rel-2',
                name: 'v1.1.0',
                description: 'Sprint analytics, Gantt roadmap timeline, and dev tool launchers.',
                status: 'unreleased',
                releaseDate: '2026-09-30',
                releasedAt: null,
                githubUrl: null
            }
        ]
    }

    function saveReleases(updated: any[]) {
        setReleases(updated)
        localStorage.setItem(`project_releases_${id}`, JSON.stringify(updated))
    }

    function handleCreateRelease(e: React.FormEvent) {
        e.preventDefault()
        if (!versionName.trim()) return
        setCreating(true)

        const newRelease = {
            id: `rel-${Date.now()}`,
            name: versionName.trim().startsWith('v') ? versionName.trim() : `v${versionName.trim()}`,
            description: description.trim(),
            status: 'unreleased',
            releaseDate: releaseDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
            releasedAt: null,
            publishGithub: publishGithub,
            githubUrl: null
        }

        const updated = [...releases, newRelease]
        saveReleases(updated)
        setVersionName('')
        setDescription('')
        setReleaseDate('')
        setShowCreateModal(false)
        setCreating(false)
    }

    async function markAsReleased(releaseId: string) {
        setReleasingId(releaseId)
        setStatusMsg(null)
        const rel = releases.find(r => r.id === releaseId)
        let ghUrl = rel?.githubUrl || null

        // Try to trigger GitHub Release creation via Octokit API
        const token = localStorage.getItem(`github_pat_${id}`)
        let repoOwner = project?.github_owner
        let repoName = project?.github_repo

        if (!repoOwner && project?.github_repo_url) {
            const parsed = extractOwnerAndRepo(project.github_repo_url)
            if (parsed) {
                repoOwner = parsed.owner
                repoName = parsed.repo
            }
        }

        if (token && repoOwner && repoName && rel) {
            try {
                const bodyText = `${rel.description || 'Software release'}\n\nResolved Issues:\n` +
                    issues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase()))
                        .map(i => `- ${i.task_display_id || i.bug_display_id}: ${i.title}`).join('\n')

                const ghRelease = await createOrGetGitHubRelease(
                    repoOwner,
                    repoName,
                    rel.name,
                    `Release ${rel.name}`,
                    bodyText,
                    token
                )
                if (ghRelease?.data?.html_url) {
                    ghUrl = ghRelease.data.html_url
                    setStatusMsg(`Successfully published ${rel.name} to GitHub Releases!`)
                }
            } catch (err: any) {
                console.warn('GitHub release publish note:', err)
                if (err?.status === 403 || err?.message?.includes('Resource not accessible')) {
                    setStatusMsg(`GitHub token lacks write access! Your GitHub Personal Access Token requires "Contents: Read and write" (or "repo" scope) permission.`)
                } else {
                    setStatusMsg(`Released locally. GitHub note: ${err.message || 'Token permission needed'}`)
                }
            }
        } else if (repoOwner && repoName) {
            ghUrl = `https://github.com/${repoOwner}/${repoName}/releases`
        }

        const updated = releases.map(r => r.id === releaseId ? { 
            ...r, 
            status: 'released', 
            releasedAt: new Date().toISOString().split('T')[0],
            githubUrl: ghUrl 
        } : r)

        saveReleases(updated)
        setReleasingId(null)
    }

    function deleteRelease(releaseId: string) {
        const updated = releases.filter(r => r.id !== releaseId)
        saveReleases(updated)
    }

    function openSyncModal(rel: any) {
        setSyncModalRelease(rel)
        const savedToken = localStorage.getItem(`github_pat_${id}`) || ''
        setGithubToken(savedToken)
        const defaultUrl = project?.github_repo_url || (project?.github_owner && project?.github_repo ? `https://github.com/${project.github_owner}/${project.github_repo}` : '')
        setRepoUrlInput(defaultUrl)
    }

    async function handleSyncToGithubSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!syncModalRelease) return
        setSyncing(true)
        setStatusMsg(null)

        let owner = project?.github_owner
        let repo = project?.github_repo

        if (repoUrlInput.trim()) {
            const parsed = extractOwnerAndRepo(repoUrlInput.trim())
            if (parsed) {
                owner = parsed.owner
                repo = parsed.repo
            }
        }

        if (githubToken.trim()) {
            localStorage.setItem(`github_pat_${id}`, githubToken.trim())
        }

        const token = githubToken.trim() || localStorage.getItem(`github_pat_${id}`) || undefined
        let ghUrl = owner && repo ? `https://github.com/${owner}/${repo}/releases` : null

        if (token && owner && repo) {
            try {
                const bodyText = `${syncModalRelease.description || 'Software release'}\n\nResolved Issues:\n` +
                    issues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase()))
                        .map(i => `- ${i.task_display_id || i.bug_display_id}: ${i.title}`).join('\n')

                const res = await createOrGetGitHubRelease(owner, repo, syncModalRelease.name, `Release ${syncModalRelease.name}`, bodyText, token)
                if (res?.data?.html_url) {
                    ghUrl = res.data.html_url
                    setStatusMsg(`Successfully published ${syncModalRelease.name} to GitHub Releases!`)
                }
            } catch (err: any) {
                console.warn('GitHub API error', err)
                if (err?.status === 403 || err?.message?.includes('Resource not accessible')) {
                    setStatusMsg(`GitHub Access Denied (403): Your Personal Access Token needs "Contents: Read and write" (Fine-grained token) or "repo" scope (Classic token).`)
                } else {
                    setStatusMsg(`GitHub Note: ${err.message || 'Check GitHub token scope'}`)
                }
            }
        } else if (owner && repo) {
            setStatusMsg(`Linked ${syncModalRelease.name} to GitHub repository releases page (${ghUrl}). Add a PAT to auto-create release tags.`)
        }

        const updated = releases.map(r => r.id === syncModalRelease.id ? {
            ...r,
            githubUrl: ghUrl
        } : r)

        saveReleases(updated)
        setSyncing(false)
        setSyncModalRelease(null)
    }

    if (loading) {
        return (
            <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-white">
                <Loader2 className="w-6 h-6 animate-spin text-[#0052CC]" />
            </div>
        )
    }

    const unreleasedCount = releases.filter(r => r.status === 'unreleased').length
    const releasedCount = releases.filter(r => r.status === 'released').length

    const filteredReleases = releases.filter(r => {
        if (r.status !== activeTab) return false
        if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase()) && !r.description.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false
        }
        return true
    })

    return (
        <div className="flex flex-col flex-1 h-[calc(100vh-56px)] bg-white overflow-hidden text-[#172B4D]">
            
            {/* JIRA STANDARD HEADER */}
            <div className="px-8 pt-6 pb-4 border-b border-[#DFE1E6] flex items-center justify-between flex-shrink-0 bg-white">
                <div>
                    <div className="flex items-center text-xs text-[#5E6C84] mb-1">
                        <Link to="/projects" className="hover:underline">Projects</Link>
                        <span className="mx-2">/</span>
                        <Link to={`/projects/${id}`} className="hover:underline">{project?.name}</Link>
                        <span className="mx-2">/</span>
                        <span className="text-[#172B4D] font-medium">Releases</span>
                    </div>
                    <h1 className="text-2xl font-medium tracking-tight text-[#172B4D]">Releases</h1>
                </div>

                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="h-8 px-3 bg-[#0052CC] hover:bg-[#0047B3] text-white text-sm font-medium rounded transition-colors flex items-center gap-1.5 shadow-xs"
                >
                    <Plus className="w-4 h-4" />
                    Create version
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-[1200px] w-full">
                
                {/* JIRA TABS & SEARCH BAR */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#DFE1E6] pb-3">
                    <div className="flex gap-6 text-sm font-medium">
                        <button
                            onClick={() => setActiveTab('unreleased')}
                            className={`pb-3 border-b-2 transition-colors ${
                                activeTab === 'unreleased'
                                    ? 'border-[#0052CC] text-[#0052CC] font-semibold'
                                    : 'border-transparent text-[#42526E] hover:text-[#172B4D]'
                            }`}
                        >
                            Unreleased ({unreleasedCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('released')}
                            className={`pb-3 border-b-2 transition-colors ${
                                activeTab === 'released'
                                    ? 'border-[#0052CC] text-[#0052CC] font-semibold'
                                    : 'border-transparent text-[#42526E] hover:text-[#172B4D]'
                            }`}
                        >
                            Released ({releasedCount})
                        </button>
                    </div>

                    <div className="relative w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#5E6C84]" />
                        <input 
                            type="text"
                            placeholder="Filter versions..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-[#FAFBFC] border border-[#DFE1E6] rounded px-3 pl-9 py-1.5 text-sm outline-none focus:border-[#4C9AFF] focus:bg-white"
                        />
                    </div>
                </div>

                {/* STATUS ALERT NOTIFICATION */}
                {statusMsg && (
                    <div className="p-3 bg-[#EAE6FF] border border-[#998DD9] text-[#403294] rounded text-xs flex items-center justify-between font-medium">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#6E5DC6]" />
                            {statusMsg}
                        </div>
                        <button onClick={() => setStatusMsg(null)} className="text-[#6E5DC6] hover:text-[#403294]">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* JIRA RELEASES TABLE */}
                <div className="border border-[#DFE1E6] rounded-[3px] overflow-hidden">
                    <table className="w-full text-left text-sm text-[#172B4D]">
                        <thead className="bg-[#FAFBFC] border-b border-[#DFE1E6] text-xs font-bold text-[#5E6C84] uppercase">
                            <tr>
                                <th className="px-4 py-3">Version</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Progress</th>
                                <th className="px-4 py-3">Release Date</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#DFE1E6]">
                            {filteredReleases.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-[#5E6C84] text-sm">
                                        No {activeTab} releases found. Click <strong>Create version</strong> above to add one.
                                    </td>
                                </tr>
                            ) : (
                                filteredReleases.map(rel => {
                                    const doneCount = issues.filter(i => ['done', 'resolved', 'closed'].includes(i.status?.toLowerCase())).length
                                    const totalCount = issues.length
                                    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100

                                    const repoOwner = project?.github_owner || (project?.github_repo_url ? extractOwnerAndRepo(project.github_repo_url)?.owner : null)
                                    const repoName = project?.github_repo || (project?.github_repo_url ? extractOwnerAndRepo(project.github_repo_url)?.repo : null)
                                    const effectiveGithubUrl = rel.githubUrl || (repoOwner && repoName ? `https://github.com/${repoOwner}/${repoName}/releases/tag/${rel.name}` : null)

                                    return (
                                        <tr key={rel.id} className="hover:bg-[#FAFBFC] transition-colors">
                                            {/* Version Name */}
                                            <td className="px-4 py-3 font-semibold text-[#0052CC] whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Tag className="w-4 h-4 text-[#5E6C84]" />
                                                    <span>{rel.name}</span>
                                                    {effectiveGithubUrl ? (
                                                        <a 
                                                            href={effectiveGithubUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="flex items-center gap-1 text-[11px] bg-[#EAE6FF] text-[#403294] hover:bg-[#403294] hover:text-white px-2 py-0.5 rounded font-mono transition-colors"
                                                            title="View Release on GitHub"
                                                        >
                                                            <Github className="w-3 h-3" />
                                                            <span>GitHub</span>
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </a>
                                                    ) : (
                                                        <button
                                                            onClick={() => openSyncModal(rel)}
                                                            className="flex items-center gap-1 text-[10px] text-[#0052CC] bg-[#E9F2FF] hover:bg-[#DEEBFF] px-2 py-0.5 rounded border border-[#B3D4FF] transition-colors"
                                                            title="Click to sync release with GitHub"
                                                        >
                                                            <Github className="w-3 h-3 text-[#0052CC]" />
                                                            Git Sync ↗
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                                    rel.status === 'released' ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-[#DEEBFF] text-[#0052CC]'
                                                }`}>
                                                    {rel.status}
                                                </span>
                                            </td>

                                            {/* Progress Bar */}
                                            <td className="px-4 py-3 min-w-[160px]">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[11px] text-[#5E6C84]">
                                                        <span>Issues</span>
                                                        <span className="font-semibold">{pct}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-[#DFE1E6] rounded-full overflow-hidden">
                                                        <div className="h-full bg-[#00875A] transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Release Date */}
                                            <td className="px-4 py-3 text-xs text-[#5E6C84] whitespace-nowrap">
                                                {rel.releaseDate}
                                            </td>

                                            {/* Description */}
                                            <td className="px-4 py-3 text-xs text-[#5E6C84] max-w-xs truncate">
                                                {rel.description || 'No description provided.'}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    {rel.status === 'unreleased' && (
                                                        <button 
                                                            onClick={() => markAsReleased(rel.id)}
                                                            disabled={releasingId === rel.id}
                                                            className="text-xs bg-[#00875A] text-white px-2.5 py-1 rounded font-medium hover:bg-[#006644] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                                        >
                                                            {releasingId === rel.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Rocket className="w-3.5 h-3.5" />
                                                            )}
                                                            Release & Sync GitHub
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => openSyncModal(rel)}
                                                        className="text-xs text-[#0052CC] hover:underline px-1 py-0.5"
                                                        title="GitHub Sync Settings"
                                                    >
                                                        <Github className="w-3.5 h-3.5 inline mr-1" />
                                                        Sync
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteRelease(rel.id)}
                                                        className="text-[#5E6C84] hover:text-[#DE350B] p-1 transition-colors"
                                                        title="Delete version"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* JIRA CREATE VERSION MODAL */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded border border-[#DFE1E6] shadow-lg max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-[#DFE1E6] pb-3">
                            <h3 className="text-base font-semibold text-[#172B4D]">Create version</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-[#5E6C84] hover:text-[#172B4D]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRelease} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#5E6C84] uppercase">Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. v1.2.0"
                                    value={versionName}
                                    onChange={e => setVersionName(e.target.value)}
                                    className="w-full border border-[#DFE1E6] rounded px-3 py-1.5 text-sm text-[#172B4D] outline-none focus:border-[#4C9AFF]"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#5E6C84] uppercase">Description</label>
                                <textarea
                                    placeholder="Summary of this release..."
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full border border-[#DFE1E6] rounded px-3 py-1.5 text-sm text-[#172B4D] outline-none focus:border-[#4C9AFF]"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#5E6C84] uppercase">Release date</label>
                                <input
                                    type="date"
                                    value={releaseDate}
                                    onChange={e => setReleaseDate(e.target.value)}
                                    className="w-full border border-[#DFE1E6] rounded px-3 py-1.5 text-sm text-[#172B4D] outline-none focus:border-[#4C9AFF]"
                                />
                            </div>

                            <div className="pt-1">
                                <label className="flex items-center gap-2 text-xs font-medium text-[#42526E] cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={publishGithub} 
                                        onChange={e => setPublishGithub(e.target.checked)} 
                                        className="rounded border-[#DFE1E6] text-[#0052CC]" 
                                    />
                                    <Github className="w-3.5 h-3.5 text-[#172B4D]" />
                                    <span>Sync release tag to GitHub repository on launch</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1E6]">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-sm text-[#42526E] hover:underline">Cancel</button>
                                <button type="submit" disabled={creating || !versionName.trim()} className="px-3 py-1.5 bg-[#0052CC] text-white text-sm font-medium rounded hover:bg-[#0047B3] disabled:opacity-50">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* GITHUB SYNC MODAL */}
            {syncModalRelease && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded border border-[#DFE1E6] shadow-lg max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-[#DFE1E6] pb-3">
                            <div className="flex items-center gap-2 text-[#172B4D]">
                                <Github className="w-5 h-5 text-[#0052CC]" />
                                <h3 className="text-base font-semibold">Sync {syncModalRelease.name} to GitHub</h3>
                            </div>
                            <button onClick={() => setSyncModalRelease(null)} className="text-[#5E6C84] hover:text-[#172B4D]">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSyncToGithubSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#5E6C84] uppercase">GitHub Repository URL / Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. https://github.com/owner/repo"
                                    value={repoUrlInput}
                                    onChange={e => setRepoUrlInput(e.target.value)}
                                    className="w-full border border-[#DFE1E6] rounded px-3 py-1.5 text-sm text-[#172B4D] outline-none focus:border-[#4C9AFF]"
                                />
                                <p className="text-[11px] text-[#5E6C84]">Specify repository URL to link this release tag directly.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#5E6C84] uppercase">GitHub Personal Access Token (Optional)</label>
                                <input
                                    type="password"
                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    value={githubToken}
                                    onChange={e => setGithubToken(e.target.value)}
                                    className="w-full border border-[#DFE1E6] rounded px-3 py-1.5 text-sm text-[#172B4D] outline-none focus:border-[#4C9AFF] font-mono"
                                />
                                <p className="text-[11px] text-[#5E6C84]">Providing a PAT creates the release tag via GitHub REST API.</p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-[#DFE1E6]">
                                <button type="button" onClick={() => setSyncModalRelease(null)} className="px-3 py-1.5 text-sm text-[#42526E] hover:underline">Cancel</button>
                                <button type="submit" disabled={syncing} className="px-3 py-1.5 bg-[#0052CC] text-white text-sm font-medium rounded hover:bg-[#0047B3] disabled:opacity-50 flex items-center gap-1.5">
                                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
                                    Sync & Link Release
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
