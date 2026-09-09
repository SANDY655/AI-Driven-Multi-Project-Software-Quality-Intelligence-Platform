import os
import json
import hashlib
import requests
import re
import subprocess
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv(dotenv_path="../.env")

# Initialize Supabase client
supabase_url = os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY")

try:
    if supabase_url and supabase_key:
        supabase: Client = create_client(supabase_url, supabase_key)
    else:
        supabase = None
except Exception as e:
    print(f"Error initializing Supabase in rag_engine: {e}")
    supabase = None

# Local Llama configuration (using Ollama)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama2")

print(f"Using Ollama at {OLLAMA_BASE_URL} with embedding model: {EMBEDDING_MODEL}, LLM model: {LLM_MODEL}")

def clean_ollama_error(e: Exception, action: str) -> str:
    err_str = str(e)
    if "ConnectionRefusedError" in err_str or "10061" in err_str or "Max retries exceeded" in err_str or "ConnectionResetError" in err_str:
        return f"Ollama is not running. Please make sure Ollama is installed and running on port 11434 (using the '{LLM_MODEL}' and '{EMBEDDING_MODEL}' models)."
    return f"Error during {action}: {err_str}"

# Define schemas for structured output
class PrioritySeverityPrediction(BaseModel):
    priority: str = Field(description="One of: 'P0', 'P1', 'P2', 'P3'")
    severity: str = Field(description="One of: 'critical', 'high', 'medium', 'low'")
    rationale: str = Field(description="Explanation of why this priority/severity was chosen based on the context.")

class DeveloperRecommendation(BaseModel):
    recommended_developer_id: str = Field(description="The UUID of the best developer for the job")
    rationale: str = Field(description="Explanation of why this developer is recommended.")

def get_embedding(text: str) -> list[float]:
    """Generates an embedding using local Ollama embedding model."""
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/embeddings",
            json={"model": EMBEDDING_MODEL, "prompt": text},
            timeout=30
        )
        response.raise_for_status()
        embedding = response.json()["embedding"]
        print(f"Generated embedding with dimension: {len(embedding)}")
        return embedding
    except Exception as e:
        print(f"Warning: Could not use Ollama embedding API ({e}). Using fallback hash-based embedding.")
        hash_obj = hashlib.sha256(text.encode())
        hash_hex = hash_obj.hexdigest()
        
        # Convert hex to float array (768 dimensions)
        embedding = []
        for i in range(0, 768):
            char_idx = (i * 2) % len(hash_hex)
            byte_val = int(hash_hex[char_idx:char_idx+2], 16) if char_idx+2 <= len(hash_hex) else 0
            embedding.append((byte_val - 128) / 128.0)
        return embedding

def format_bug_context(similar_bugs: list) -> str:
    """Formats similar bugs into a readable string for the LLM context."""
    if not similar_bugs:
        return "No similar historical bugs found."
    
    context = ""
    for idx, bug in enumerate(similar_bugs):
        context += f"--- Historical Bug {idx + 1} ---\n"
        context += f"Title: {bug.get('title')}\n"
        context += f"Severity: {bug.get('severity')}\n"
        context += f"Priority: {bug.get('priority')}\n"
        context += f"Assigned To: {bug.get('assigned_to')}\n"
        context += f"Description: {bug.get('description')}\n\n"
    return context

def predict_priority_severity(bug_title: str, bug_description: str, similar_bugs: list, project_details: dict | None = None) -> dict:
    """Uses local Llama model to predict priority and severity based on past similar bugs and project context."""
    context = format_bug_context(similar_bugs)
    
    project_context = ""
    if project_details:
        project_context = f"\nProject Context:\nName: {project_details.get('name')}\nDescription: {project_details.get('description')}\nLanguage/Tech: {project_details.get('github_details', {}).get('language', 'Unknown')}\n"
    
    prompt = f"""Analyze this bug report and classify its priority and severity.

Bug Title: {bug_title}
Bug Description: {bug_description}

Classification Rules:
- If the app crashes, fails to load, has data loss, or has security vulnerabilities, classify it as: severity "critical" and priority "P0".
- If a main feature is broken but the app runs, classify as: severity "high" and priority "P1".
- If it is a standard bug with a workaround, classify as: severity "medium" and priority "P2".
- If it is cosmetic/layout/visual only, classify as: severity "low" and priority "P3".

You must respond with a JSON object containing exactly these keys:
{{
  "priority": "P0" or "P1" or "P2" or "P3",
  "severity": "critical" or "high" or "medium" or "low",
  "rationale": "a short explanation of why this was chosen"
}}"""
    
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=60
        )
        response.raise_for_status()
        response_text = response.json()["response"]
        
        # Extract JSON from response
        try:
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError:
            # Try to extract JSON from the response text
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(response_text[json_start:json_end])
                return result
            # Fallback response
            return {
                "priority": "P2",
                "severity": "medium",
                "rationale": "Default priority assigned due to parsing error"
            }
    except Exception as e:
        print(f"Error calling Ollama: {e}")
        return {
            "priority": "P2",
            "severity": "medium",
            "rationale": clean_ollama_error(e, "analysis")
        }

def get_git_blame_info(title: str, description: str, db_client: Client | None) -> dict | None:
    """Scans bug title and description for file path patterns, executes git blame, 
    and resolves the author profile if possible."""
    if not db_client:
        return None

    # Matches paths like src/middleware/auth.ts or src/middleware/auth.ts:15
    # Restricts to common extensions: py, ts, tsx, js, jsx, json, html, css, sql, go, java, cpp, h, c, cs, rb, php, sh, txt, md, yaml, yml, xml
    pattern = r'\b([a-zA-Z0-9_\-\/]+\.(?:py|ts|tsx|js|jsx|json|html|css|sql|go|java|cpp|h|c|cs|rb|php|sh|txt|md|yaml|yml|xml))(?::(\d+))?\b'
    
    matches = re.findall(pattern, f"{title}\n{description}")
    if not matches:
        return None

    # Try matching file paths
    for file_path, line_number in matches:
        # Resolve full path relative to repo root
        # Since the backend runs in ai-service/ folder, the repo root is ..
        full_path = os.path.join("..", file_path)
        if not os.path.exists(full_path):
            # Check if it matches a file basename in the codebase (e.g. if bug report says auth.ts instead of src/middleware/auth.ts)
            found = False
            for root, dirs, files in os.walk(".."):
                # Skip .git, node_modules, etc.
                if ".git" in root or "node_modules" in root or ".venv" in root or "__pycache__" in root:
                    continue
                if os.path.basename(file_path) in files:
                    full_path = os.path.join(root, os.path.basename(file_path))
                    file_path = os.path.relpath(full_path, "..").replace("\\", "/")
                    found = True
                    break
            if not found:
                continue

        # Run git blame on this file
        try:
            if line_number:
                line_num = int(line_number)
                cmd = ["git", "blame", "-e", "-L", f"{line_num},{line_num}", "--", file_path]
            else:
                cmd = ["git", "blame", "-e", "--", file_path]

            result = subprocess.run(
                cmd,
                cwd="..",
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            
            blame_output = result.stdout
            
            # Extract emails (formatted as <email@domain.com>)
            emails = re.findall(r'<([^>]+)>', blame_output)
            if not emails:
                continue
                
            # If a specific line is blamed, pick the email on that line
            if line_number:
                author_email = emails[0]
            else:
                # If the entire file is blamed, pick the most frequent committer email
                from collections import Counter
                author_email = Counter(emails).most_common(1)[0][0]
                
            # Query profiles table for this email
            profile_res = db_client.table("profiles").select("id, display_name").eq("email", author_email).execute()
            if profile_res.data:
                profile = profile_res.data[0]
                return {
                    "developer_id": profile["id"],
                    "developer_name": profile["display_name"],
                    "file_path": file_path,
                    "line_number": line_number or None,
                    "email": author_email
                }
        except Exception as e:
            print(f"Error running git blame on {file_path}: {e}")
            
    return None

def recommend_developer(bug_title: str, bug_description: str, similar_bugs: list, project_details: dict | None = None, project_members: list | None = None, db_client: Client | None = None) -> dict:
    """Uses local Llama model to recommend an assignee based on who fixed similar bugs, project context, skills, workloads, and git blame ownership."""
    context = format_bug_context(similar_bugs)
    
    project_context = ""
    if project_details:
        project_context = f"\nProject Context:\nName: {project_details.get('name')}\nDescription: {project_details.get('description')}\nLanguage/Tech: {project_details.get('github_details', {}).get('language', 'Unknown')}\n"
        
    members_context = ""
    if project_members:
        members_context = "\nAvailable Developers:\n"
        for member in project_members:
            user_id = member.get("user_id")
            profiles = member.get("profiles", {})
            name = profiles.get("display_name", "Unknown") if profiles else "Unknown"
            skills = profiles.get("skills", []) if profiles else []
            workload = profiles.get("current_workload", 0) if profiles else 0
            members_context += f"- Name: {name}, ID: {user_id}, Skills: {skills}, Current Workload: {workload} active tickets\n"
            
    # Check for git blame information
    blame_info = get_git_blame_info(bug_title, bug_description, db_client or supabase)
    blame_context = ""
    if blame_info:
        line_str = f"line {blame_info['line_number']}" if blame_info['line_number'] else "most changes"
        blame_context = f"\nGit Blame Insights:\n- File referenced in bug: '{blame_info['file_path']}' ({line_str})\n- Code Author: '{blame_info['developer_name']}' (ID: {blame_info['developer_id']})\n(Note: This developer is the author/owner of the code causing the bug, making them a very strong candidate to fix it.)\n"

    prompt = f"""You are a technical project manager. Your task is to assign a new bug to the most appropriate developer from the Available Developers list.

Rules for Recommendation:
1. Prioritize code ownership (Git Blame Insights). If a developer is identified as the author of the code containing the bug, they are typically the best fit.
2. Consider skills fit: Match keywords in the bug report to developer skills.
3. Balance workload: Avoid recommending developers who have a high active workload (e.g. 5+ active tickets) unless they are the clear expert or author.
{project_context}{members_context}{blame_context}
Historical Context (Similar Bugs):
{context}

New Bug Report:
Title: {bug_title}
Description: {bug_description}

Respond with a JSON object containing exactly these fields:
- recommended_developer_id: the UUID of the best developer for the job (MUST be one from the Available Developers list, or '00000000-0000-0000-0000-000000000000' if no developer fits)
- rationale: brief explanation of why this developer is recommended (mentioning skills matching, workload balancing, or git blame ownership where applicable)

JSON Response:"""
    
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=60
        )
        response.raise_for_status()
        response_text = response.json()["response"]
        
        def validate_result(res: dict) -> dict:
            rec_id = res.get("recommended_developer_id")
            if project_members:
                valid_ids = [m.get("user_id") for m in project_members]
                if rec_id not in valid_ids:
                    res["recommended_developer_id"] = "00000000-0000-0000-0000-000000000000"
                    if rec_id != "00000000-0000-0000-0000-000000000000":
                        res["rationale"] = f"Original recommendation was invalid ({rec_id}). " + res.get("rationale", "")
            else:
                res["recommended_developer_id"] = "00000000-0000-0000-0000-000000000000"
            return res

        # Extract JSON from response
        try:
            result = json.loads(response_text)
            return validate_result(result)
        except json.JSONDecodeError:
            # Try to extract JSON from the response text
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(response_text[json_start:json_end])
                return validate_result(result)
            # Fallback response
            return {
                "recommended_developer_id": "00000000-0000-0000-0000-000000000000",
                "rationale": "No developer recommendation could be made due to JSON parsing error"
            }
    except Exception as e:
        print(f"Error calling Ollama: {e}")
        return {
            "recommended_developer_id": "00000000-0000-0000-0000-000000000000",
            "rationale": clean_ollama_error(e, "recommendation")
        }

def review_commit(bug_title: str, bug_description: str, commit_message: str, commit_diff: str) -> dict:
    """Uses local Llama model to review a commit diff against the original bug report."""
    prompt = f"""You are an expert Senior Software Engineer performing a code review.
Your task is to determine if the provided git diff safely and accurately resolves the reported bug.
Provide constructive feedback, identify potential regressions, and give a final approval status.

Bug Report:
Title: {bug_title}
Description: {bug_description}

Commit Message:
{commit_message}

Git Diff:
{commit_diff}

Respond with a JSON object containing exactly these fields:
- status: one of 'approved', 'changes_requested', 'neutral'
- feedback: detailed code review comment explaining your reasoning

JSON Response:"""

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            },
            timeout=120
        )
        response.raise_for_status()
        response_text = response.json()["response"]
        
        try:
            result = json.loads(response_text)
            return result
        except json.JSONDecodeError:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                return json.loads(response_text[json_start:json_end])
            return {
                "status": "neutral",
                "feedback": "Failed to parse AI response."
            }
    except Exception as e:
        print(f"Error calling Ollama for code review: {e}")
        return {
            "status": "neutral",
            "feedback": clean_ollama_error(e, "code review generation")
        }

def fetch_similar_tasks(db_client: Client, query_embedding: list[float], threshold: float = 0.5, count: int = 5, project_id: str | None = None) -> list:
    """Uses the pgvector match_tasks RPC to find similar tasks."""
    if not db_client:
        return []
    try:
        response = db_client.rpc(
            "match_tasks",
            {
                "query_embedding": query_embedding,
                "match_threshold": threshold,
                "match_count": count,
                "filter_project_id": project_id
            }
        ).execute()
        res = response.data or []
        if not res and threshold > -0.5:
            fallback = db_client.rpc(
                "match_tasks",
                {
                    "query_embedding": query_embedding,
                    "match_threshold": -1.0,
                    "match_count": count,
                    "filter_project_id": project_id
                }
            ).execute()
            res = fallback.data or []
        return res
    except Exception as e:
        print(f"Error fetching similar tasks: {e}")
        return []

def format_task_context(tasks: list) -> str:
    if not tasks:
        return "No relevant past tasks found."
    
    context = ""
    for task in tasks:
        context += f"Task ID: {task.get('task_display_id')}\n"
        context += f"Title: {task.get('title')}\n"
        context += f"Priority: {task.get('priority')}\n"
        context += f"Description: {task.get('description')}\n"
        context += "---\n"
    return context

def generate_chat_response(query: str, similar_bugs: list, similar_tasks: list, project_details: dict | None = None) -> str:
    """Uses local Llama model to answer a query based on a context of similar bugs and tasks."""
    bug_context = format_bug_context(similar_bugs)
    task_context = format_task_context(similar_tasks)
    
    project_context = ""
    if project_details:
        project_context = f"Project Context:\nName: {project_details.get('name')}\nDescription: {project_details.get('description')}\n"
    
    prompt = f"""You are a helpful AI Assistant for a software development team.
Your task is to answer the user's question based ONLY on the provided historical context and project context.
If you don't know the answer based on the context, just say you don't have enough information.
Keep your response concise and professional.

{project_context}
Historical Context (Similar Bugs):
{bug_context}

Historical Context (Similar Tasks):
{task_context}

User Question: {query}

Answer:"""
    
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False
            },
            timeout=60
        )
        response.raise_for_status()
        return response.json()["response"].strip()
    except Exception as e:
        print(f"Error calling Ollama for chat: {e}")
        return clean_ollama_error(e, "chat processing")

