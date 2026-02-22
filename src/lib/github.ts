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
        branches: branchesData.data.map(b => b.name)
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
