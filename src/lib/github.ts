import { Octokit } from '@octokit/rest'

export const getGitHubClient = (providerToken?: string) => {
    return new Octokit(providerToken ? { auth: providerToken } : {})
}

export const extractOwnerAndRepo = (url: string) => {
    try {
        const urlObj = new URL(url)
        const parts = urlObj.pathname.split('/').filter(Boolean)
        if (parts.length >= 2) {
            let repo = parts[1]
            if (repo.endsWith('.git')) {
                repo = repo.slice(0, -4)
            }
            return { owner: parts[0], repo }
        }
    } catch (e) {
        // Return null if parsing fails
    }
    return null
}

export const getRepoDetails = async (providerToken: string | undefined | null, owner: string, repo: string) => {
    const octokit = getGitHubClient(providerToken || undefined)

    const [repoData, branchesData] = await Promise.all([
        octokit.rest.repos.get({ owner, repo }),
        octokit.rest.repos.listBranches({ owner, repo }),
    ])

    return {
        name: repoData.data.name,
        description: repoData.data.description,
        stars: repoData.data.stargazers_count,
        forks: repoData.data.forks_count,
        language: repoData.data.language,
        openIssues: repoData.data.open_issues_count,
        defaultBranch: repoData.data.default_branch,
        topics: repoData.data.topics,
        branches: branchesData.data.map(b => b.name),
        private: repoData.data.private,
    }
}

export const getRepoContributors = async (owner: string, repo: string, token?: string) => {
    try {
        const octokit = new Octokit({ auth: token })
        const { data } = await octokit.rest.repos.listContributors({ owner, repo, per_page: 5 })
        return data.map(c => ({
            login: c.login,
            avatar_url: c.avatar_url,
            html_url: c.html_url,
            contributions: c.contributions
        }))
    } catch (e) {
        console.error('Failed to fetch contributors:', e)
        return []
    }
}

export const getRepoCollaborators = async (owner: string, repo: string, token?: string) => {
    if (!token) return []
    try {
        const octokit = new Octokit({ auth: token })
        const { data } = await octokit.rest.repos.listCollaborators({ owner, repo, per_page: 20 })
        return data.map(c => ({
            login: c.login,
            avatar_url: c.avatar_url,
            html_url: c.html_url,
            role_name: c.role_name ?? (c.permissions?.admin ? 'admin' : c.permissions?.push ? 'write' : 'read'),
        }))
    } catch (e: any) {
        if (e.status !== 403) {
            console.error('Failed to fetch collaborators:', e)
        }
        return []
    }
}

export const createOrGetGitHubRelease = async (
    owner: string,
    repo: string,
    tag_name: string,
    name: string,
    body: string,
    token?: string
) => {
    const octokit = new Octokit(token ? { auth: token } : {})
    
    // Check if release tag already exists on GitHub
    try {
        const existing = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag: tag_name })
        if (existing.data?.html_url) {
            return { data: existing.data, created: false }
        }
    } catch {
        // Tag does not exist yet on GitHub, proceed to creation
    }

    const { data } = await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name,
        name,
        body,
        draft: false,
        prerelease: false,
        generate_release_notes: true,
    })
    return { data, created: true }
}
