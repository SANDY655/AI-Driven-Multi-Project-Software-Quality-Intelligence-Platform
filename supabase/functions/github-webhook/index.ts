import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

// We define types for the GitHub webhook payload (simplified)
interface GitHubPushPayload {
    ref: string
    repository: {
        full_name: string
        html_url: string
    }
    commits: Array<{
        id: string
        message: string
        timestamp: string
        author: {
            name: string
            username: string
        }
        url: string
        added: string[]
        removed: string[]
        modified: string[]
    }>
}

// Regex to find bug references like "Fixes BUG-PRJ-123" or "Refs BUG-PRJ-123"
// This pattern looks for the project code prefix and a number.
const BUG_ID_REGEX = /BUG-[A-Z]+-\d+/g

// Verify GitHub Signature (Simplified for this example)
// In a production environment, use WebCrypto API to verify X-Hub-Signature-256
const verifyGitHubSignature = (secret: string | undefined, payload: string, signature: string | null) => {
    if (!secret) return true // Skip if no secret configured
    if (!signature) return false
    // Implementation of HMAC-SHA256 verification goes here
    return true
}

Deno.serve(async (req) => {
    // 1. Only accept POST requests
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    // 2. Initial Setup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseServiceKey) {
        return new Response('Server configuration error', { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    try {
        const rawBody = await req.text()
        const signature = req.headers.get('x-hub-signature-256')
        const githubEvent = req.headers.get('x-github-event')

        // Handle ping event when webhook is first added
        if (githubEvent === 'ping') {
            return new Response('pong', { status: 200 })
        }

        if (githubEvent !== 'push') {
            return new Response(`Ignoring event: ${githubEvent}`, { status: 200 })
        }

        const payload: GitHubPushPayload = JSON.parse(rawBody)
        const repoFullName = payload.repository.full_name

        // 3. Find the Project in our Database by GitHub Repo URL
        const { data: project, error: projectError } = await supabase
            .from('projects')
            // Because we store owner and repo separately:
            .select('id, webhook_secret, project_code')
            .eq('github_owner', repoFullName.split('/')[0])
            .eq('github_repo', repoFullName.split('/')[1])
            .single()

        if (projectError || !project) {
            console.log(`No project matches repo: ${repoFullName}`)
            return new Response('Ignored: Repo not tracked', { status: 200 })
        }

        // 4. Verify Webhook Secret if project has one
        if (!verifyGitHubSignature(project.webhook_secret, rawBody, signature)) {
            return new Response('Invalid Signature', { status: 401 })
        }

        // 5. Process Commits
        const branch = payload.ref.replace('refs/heads/', '')

        for (const commit of payload.commits) {
            // 5a. Insert Commit
            const { data: insertedCommit, error: commitError } = await supabase
                .from('commits')
                .insert({
                    project_id: project.id,
                    sha: commit.id,
                    message: commit.message,
                    author_name: commit.author.name,
                    github_username: commit.author.username,
                    branch: branch,
                    files_changed: commit.added.length + commit.removed.length + commit.modified.length,
                    additions: commit.added.length, // Simplified
                    deletions: commit.removed.length, // Simplified
                    url: commit.url,
                    committed_at: commit.timestamp
                })
                .select()
                .single()

            if (commitError) {
                console.error(`Error inserting commit ${commit.id}:`, commitError)
                continue // Skip to next commit on error
            }

            // 5b. Parse message for Bug IDs (e.g., "Fixed BUG-ECOM-1")
            const matches = commit.message.match(BUG_ID_REGEX) || []

            for (const bugDisplayId of matches) {
                // Find the internal bug UUID for this bug_display_id
                const { data: bug, error: bugError } = await supabase
                    .from('bugs')
                    .select('id')
                    .eq('bug_display_id', bugDisplayId)
                    .single()

                if (bug && !bugError) {
                    // 5c. Link Commit to Bug
                    await supabase
                        .from('commit_bug_links')
                        .upsert({
                            commit_id: insertedCommit.id,
                            bug_id: bug.id
                        }, { onConflict: 'commit_id,bug_id' })

                    // 5d. Add Activity Log
                    await supabase
                        .from('activity_log')
                        .insert({
                            bug_id: bug.id,
                            action: 'commit_linked',
                            metadata: { commit_sha: commit.id, commit_url: commit.url, message: commit.message }
                        })
                }
            }
        }

        return new Response(JSON.stringify({ success: true, processedCommits: payload.commits.length }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (err: any) {
        console.error('Webhook processing failed:', err)
        return new Response(`Webhook error: ${err.message}`, { status: 400 })
    }
})
