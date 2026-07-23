import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables FIRST before internal modules that depend on them
load_dotenv(dotenv_path="../.env")

from supabase import create_client, Client
from rag_engine import get_embedding, predict_priority_severity, recommend_developer

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
