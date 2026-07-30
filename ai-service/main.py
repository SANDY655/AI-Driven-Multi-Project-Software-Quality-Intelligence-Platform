import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables FIRST before internal modules that depend on them
load_dotenv(dotenv_path="../.env")

import re
from supabase import create_client, Client
from rag_engine import get_embedding, predict_priority_severity, recommend_developer, review_commit, generate_chat_response, fetch_similar_tasks

app = FastAPI(title="Capstone AI Bug Intelligence Service")

# Allow CORS for the Vite frontend (typically localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to ["http://localhost:5173"] for strict security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.environ.get("VITE_SUPABASE_URL")
# We need the service role key to bypass RLS for the AI engine, but anon key works for RPC if policies allow.
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Warning: Supabase credentials not found in environment.")

try:
    supabase: Client = create_client(supabase_url, supabase_key)
except Exception:
    supabase = None

class BugRequest(BaseModel):
    title: str
    description: str
    project_id: str | None = None

def fetch_similar_bugs(embedding: list[float], threshold: float = 0.8, count: int = 5, project_id: str | None = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
    
    response = supabase.rpc(
        "match_bugs", 
        {
            "query_embedding": embedding, 
            "match_threshold": threshold, 
            "match_count": count,
            "filter_project_id": project_id
        }
    ).execute()
    
    return response.data

def fetch_project_details(project_id: str | None) -> dict | None:
    if not supabase or not project_id:
        return None
    response = supabase.table("projects").select("name, description, github_details").eq("id", project_id).execute()
    if response.data and len(response.data) > 0:
        return response.data[0]
    return None

def fetch_project_members(project_id: str | None) -> list:
    if not supabase or not project_id:
        return []
    response = supabase.table("project_members").select("user_id, project_role, profiles(display_name, skills, current_workload)").eq("project_id", project_id).execute()
    return response.data or []

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/embed-bug")
def embed_bug(bug_id: str, request: BugRequest):
    """Generates an embedding for a bug and stores it in Supabase (can be called via Webhook)."""
    text_to_embed = f"Title: {request.title}\nDescription: {request.description}"
    embedding = get_embedding(text_to_embed)
    
    if supabase:
        supabase.table("bugs").update({"embedding": embedding}).eq("id", bug_id).execute()
        
    return {"status": "success", "message": "Embedding generated and stored."}

@app.post("/api/analyze-bug")
def analyze_bug(request: BugRequest):
    """Predicts Priority and Severity for a new bug using RAG."""
    text_to_embed = f"Title: {request.title}\nDescription: {request.description}"
    embedding = get_embedding(text_to_embed)
    
    # 1. Retrieve similar bugs scoped to this project
    similar_bugs = fetch_similar_bugs(embedding, threshold=0.7, count=5, project_id=request.project_id)
    
    # 2. Fetch project context
    project_details = fetch_project_details(request.project_id)
    
    # 3. Augment and Generate
    prediction = predict_priority_severity(request.title, request.description, similar_bugs, project_details)
    
    return {
        "prediction": prediction,
        "similar_bugs_used": len(similar_bugs)
    }

@app.post("/api/detect-duplicates")
def detect_duplicates(request: BugRequest):
    """Returns potential duplicate bugs based on vector similarity."""
    text_to_embed = f"Title: {request.title}\nDescription: {request.description}"
    embedding = get_embedding(text_to_embed)
    
    # High threshold for duplicates, scoped to the project
    similar_bugs = fetch_similar_bugs(embedding, threshold=0.85, count=3, project_id=request.project_id)
    
    return {
        "duplicates": similar_bugs
    }

@app.post("/api/recommend-assignee")
def get_recommended_assignee(request: BugRequest):
    """Recommends a developer based on historical bug fixes."""
    text_to_embed = f"Title: {request.title}\nDescription: {request.description}"
    embedding = get_embedding(text_to_embed)
    
    similar_bugs = fetch_similar_bugs(embedding, threshold=0.7, count=5, project_id=request.project_id)
    
    project_details = fetch_project_details(request.project_id)
    project_members = fetch_project_members(request.project_id)
    
    recommendation = recommend_developer(request.title, request.description, similar_bugs, project_details, project_members)
    
    return {
        "recommendation": recommendation,
        "similar_bugs_used": len(similar_bugs)
    }

class TaskEmbedRequest(BaseModel):
    task_id: str
    title: str
    description: str

@app.post("/api/embed-task")
def embed_task(request: TaskEmbedRequest):
    """Generates an embedding for a task and stores it in the database."""
    context_text = f"Title: {request.title}\nDescription: {request.description}"
    try:
        embedding = get_embedding(context_text)
        supabase.table("tasks").update({"embedding": embedding}).eq("id", request.task_id).execute()
        return {"status": "success"}
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"Error embedding task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate or save embedding. Traceback: {trace}")

class ChatRequest(BaseModel):
    query: str
    project_id: str | None = None

@app.post("/api/chat")
def chat(request: ChatRequest):
    """Answers a user's question using semantic search over project bugs and tasks."""
    embedding = get_embedding(request.query)
    
    # Retrieve top 5 most relevant bugs and tasks
    similar_bugs = fetch_similar_bugs(embedding, threshold=0.5, count=5, project_id=request.project_id)
    similar_tasks = fetch_similar_tasks(embedding, threshold=0.5, count=5, project_id=request.project_id)
    
    project_details = fetch_project_details(request.project_id)
    
    response_text = generate_chat_response(request.query, similar_bugs, similar_tasks, project_details)
    
    return {
        "response": response_text,
        "context_bugs_used": len(similar_bugs),
        "context_tasks_used": len(similar_tasks)
    }

class GitHubWebhookPayload(BaseModel):
    ref: str | None = None
    commits: list[dict] | None = None
    repository: dict | None = None
    simulated_diff: str | None = None

from datetime import datetime, timezone

@app.post("/api/webhook/github")
def github_webhook(payload: GitHubWebhookPayload):
    """Receives GitHub push events, links commits to bugs/tasks, auto-resolves, and runs AI code review."""
    if not payload.commits:
        return {"status": "ignored", "message": "No commits in payload."}

    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")

    processed_commits = []

    for commit in payload.commits:
        message = commit.get("message", "")
        # Look for bug ID (PROJ-123) or task ID (PROJ-T123)
        match = re.search(r'([A-Z]+-(?:T)?\d+)', message.upper())
        if not match:
            continue
            
        display_id = match.group(1)
        is_task = "-T" in display_id
        
        # Determine if there's a fix/close keyword
        action_match = re.search(r'(?i)(fix|fixes|fixed|close|closes|closed|resolve|resolves|resolved)\s+' + re.escape(display_id), message)
        is_resolving = bool(action_match)
        
        # 1. Find the bug or task
        table_name = "tasks" if is_task else "bugs"
        id_column = "task_display_id" if is_task else "bug_display_id"
        
        res = supabase.table(table_name).select(f"id, title, description, status, created_at, project_id").eq(id_column, display_id).execute()
        if not res.data:
            continue
            
        ticket = res.data[0]
        ticket_id = ticket["id"]
        
        commit_sha = commit.get("id", "simulated-sha-" + str(hash(message))[-6:])
        commit_url = commit.get("url", f"https://github.com/simulated/commit/{commit_sha}")
        author_name = commit.get("author", {}).get("name", "Unknown Developer")
        
        # 2. Insert into commits 
        try:
            commit_res = supabase.table("commits").insert({
                "project_id": ticket["project_id"],
                "sha": commit_sha,
                "message": message,
                "author_name": author_name,
                "url": commit_url,
                "committed_at": datetime.now(timezone.utc).isoformat()
            }).execute()
            inserted_commit_id = commit_res.data[0]["id"]
        except Exception as e:
            print("Commit might already exist or error:", e)
            existing = supabase.table("commits").select("id").eq("sha", commit_sha).execute()
            if existing.data:
                inserted_commit_id = existing.data[0]["id"]
            else:
                continue
            
        # 3. Link commit to bug/task
        link_table = "commit_task_links" if is_task else "commit_bug_links"
        foreign_key = "task_id" if is_task else "bug_id"
        try:
            supabase.table(link_table).insert({
                foreign_key: ticket_id,
                "commit_id": inserted_commit_id
            }).execute()
        except Exception as e:
            print("Link error:", e)
            
        # 4. Auto-resolve and SLA
        sla_text = ""
        if is_resolving:
            resolved_at = datetime.now(timezone.utc)
            created_at = datetime.fromisoformat(ticket["created_at"].replace('Z', '+00:00'))
            resolution_time = resolved_at - created_at
            
            hours = int(resolution_time.total_seconds() // 3600)
            days = hours // 24
            remaining_hours = hours % 24
            
            sla_msg = f"{days} days, {remaining_hours} hours" if days > 0 else f"{hours} hours"
            sla_text = f"\n\n**SLA:** Auto-resolved via commit in {sla_msg}."
            
            new_status = "done" if is_task else "resolved"
            supabase.table(table_name).update({
                "status": new_status,
                "resolved_at": resolved_at.isoformat()
            }).eq("id", ticket_id).execute()
            
            # Add activity log for status change
            supabase.table("task_activity_log" if is_task else "activity_log").insert({
                foreign_key: ticket_id,
                "action": "status_changed",
                "old_value": ticket["status"],
                "new_value": new_status
            }).execute()

        # 5. Run AI Code Review
        diff = payload.simulated_diff
        if not diff:
            added = commit.get("added", [])
            modified = commit.get("modified", [])
            removed = commit.get("removed", [])
            diff = f"Simulated Diff:\nAdded: {added}\nModified: {modified}\nRemoved: {removed}"

        review = review_commit(ticket["title"], ticket["description"], message, diff)
        
        # 6. Insert AI Review into comments
        bot_comment = f"🤖 **AI Code Review Assistant**\n\n**Status:** {review.get('status', 'neutral').upper()}\n\n{review.get('feedback', 'No feedback provided.')}\n\n*Reviewed commit: [{commit_sha[:7]}]({commit_url})*{sla_text}"
        
        comment_table = "task_comments" if is_task else "bug_comments"
        try:
            supabase.table(comment_table).insert({
                foreign_key: ticket_id,
                "content": bot_comment
            }).execute()
        except Exception as e:
            print(f"Error inserting comment: {e}")
            
        # 7. Add activity log for link
        try:
            supabase.table("task_activity_log" if is_task else "activity_log").insert({
                foreign_key: ticket_id,
                "action": "commit_linked",
                "new_value": commit_sha[:7]
            }).execute()
        except Exception:
            pass
            
        processed_commits.append(commit_sha)

    return {"status": "success", "processed_commits": processed_commits}
