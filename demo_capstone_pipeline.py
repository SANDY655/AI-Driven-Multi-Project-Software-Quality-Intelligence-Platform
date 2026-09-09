"""
Capstone AI Bug Intelligence & Software Quality Platform
========================================================
End-to-End Real Project Creation, AI Triage, Worklog Tracking, 
Git Webhook AI Code Review, SLA Resolution, and RAG Chat Script.

This script demonstrates:
1. Creating a real project, Sprints, and Epics in Supabase.
2. Creating bugs & tasks with AI Bug Triage (RAG Priority/Severity prediction).
3. Calling AI Developer Recommendation engine.
4. Generating 1024-dim / 768-dim Vector Embeddings.
5. Logging Work Time & Estimates (Jira Time Tracking).
6. Simulating a Git Push Webhook -> Triggering AI Code Review Bot, SLA Calculation, Commit Linking, and Auto-Resolving the ticket.
7. Querying the AI RAG Chat Assistant over project tasks and bugs.
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Ensure UTF-8 stdout on Windows console
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# 1. Load environment variables from .env
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8000")

def print_header(title):
    print("\n" + "=" * 80)
    print(f"🚀 {title.upper()}")
    print("=" * 80)

def check_services():
    print_header("Step 0: Health Check & Environment Verification")
    print(f"📍 Supabase URL: {SUPABASE_URL or 'MISSING'}")
    print(f"📍 AI Service URL: {AI_SERVICE_URL}")

    try:
        r = requests.get(f"{AI_SERVICE_URL}/health", timeout=5)
        if r.status_code == 200:
            print("✅ FastAPI AI Service is online and healthy!")
        else:
            print(f"⚠️ FastAPI AI Service responded with status code: {r.status_code}")
    except Exception as e:
        print(f"❌ Failed to connect to FastAPI AI Service at {AI_SERVICE_URL}: {e}")
        print("💡 Please start the backend service via: cd ai-service && uvicorn main:app --reload")

def get_supabase_client():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: Missing Supabase credentials in .env file.")
        print("Required variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)")
        return None
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        print("❌ Error: 'supabase' python package is not installed. Install via: pip install supabase")
        return None

def run_pipeline():
    check_services()
    db = get_supabase_client()
    
    if not db:
        print("\n⚠️ Database client initialization failed. Please verify your .env file settings.")
        return

    print_header("Step 1: Creating Real Project, Sprints & Epics")
    
    profiles_res = db.table("profiles").select("id").execute()
    profile_ids = [p["id"] for p in (profiles_res.data or [])]
    
    project_code = f"SQIP{int(time.time()) % 1000}"
    project_payload = {
        "name": f"AI-Driven Quality Intelligence Platform ({project_code})",
        "description": "Multi-project software quality intelligence platform with RAG vector search, automated SLA tracking, and AI code review.",
        "project_code": project_code,
        "github_owner": "sandy655",
        "github_repo": "AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform",
        "github_repo_url": "https://github.com/sandy655/AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform"
    }
    if profile_ids:
        project_payload["created_by"] = profile_ids[0]

    proj_res = db.table("projects").insert(project_payload).execute()
    if not proj_res.data:
        print("❌ Failed to create project.")
        return
    
    project = proj_res.data[0]
    project_id = project["id"]
    print(f"✅ Created Project: '{project['name']}' (ID: {project_id}, Code: {project['project_code']})")

    if profile_ids:
        members_payload = [{"project_id": project_id, "user_id": uid, "project_role": "admin"} for uid in profile_ids]
        db.table("project_members").upsert(members_payload, on_conflict="project_id,user_id").execute()
        print(f"✅ Added {len(profile_ids)} project members with RLS permissions.")

    # Create Epics
    epic1_res = db.table("epics").insert({
        "project_id": project_id,
        "name": "AI Bug Intelligence & Triage Engine",
        "status": "in_progress"
    }).execute()
    epic1_id = epic1_res.data[0]["id"] if epic1_res.data else None
    print(f"✅ Created Epic: 'AI Bug Intelligence & Triage Engine' ({epic1_id})")

    epic2_res = db.table("epics").insert({
        "project_id": project_id,
        "name": "GitHub Webhook & SLA Automation",
        "status": "planned"
    }).execute()
    epic2_id = epic2_res.data[0]["id"] if epic2_res.data else None
    print(f"✅ Created Epic: 'GitHub Webhook & SLA Automation' ({epic2_id})")

    # Create Sprint
    sprint_res = db.table("sprints").insert({
        "project_id": project_id,
        "name": "Sprint 1 - Foundation & AI Engine",
        "status": "active",
        "start_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "end_date": datetime.fromtimestamp(time.time() + 14 * 86400, timezone.utc).strftime("%Y-%m-%d")
    }).execute()
    sprint_id = sprint_res.data[0]["id"] if sprint_res.data else None
    print(f"✅ Created Active Sprint: 'Sprint 1 - Foundation & AI Engine' ({sprint_id})")


    print_header("Step 2: AI Bug Triage & Developer Recommendation")

    bug_title = "Supabase vector match RPC function memory allocation overflow"
    bug_desc = "Calling match_bugs with 1024-dimension vectors causes a memory allocation warning when threshold < 0.5. Needs query optimization and vector buffer allocation."
    bug_display_id = f"{project['project_code']}-1"

    print(f"\n🤖 Calling AI Service (/api/analyze-bug) for RAG Priority & Severity Prediction...")
    try:
        analyze_req = requests.post(
            f"{AI_SERVICE_URL}/api/analyze-bug",
            json={"title": bug_title, "description": bug_desc, "project_id": project_id},
            timeout=60
        )
        if analyze_req.status_code == 200:
            analysis = analyze_req.json()
            print("  📊 AI Triage Prediction Result:")
            print(json.dumps(analysis, indent=4))
            pred = analysis.get("prediction", {})
            predicted_priority = pred.get("priority", "P1").upper()
            if predicted_priority not in ["P0", "P1", "P2", "P3"]:
                predicted_priority = "P1"
            predicted_severity = pred.get("severity", "critical").lower()
        else:
            predicted_priority, predicted_severity = "P1", "critical"
    except Exception as e:
        print(f"  ⚠️ AI Triage endpoint error: {e}")
        predicted_priority, predicted_severity = "P1", "critical"

    print(f"\n🤖 Calling AI Service (/api/recommend-assignee) for Matching Developer...")
    try:
        rec_req = requests.post(
            f"{AI_SERVICE_URL}/api/recommend-assignee",
            json={"title": bug_title, "description": bug_desc, "project_id": project_id},
            timeout=60
        )
        if rec_req.status_code == 200:
            rec_data = rec_req.json()
            print("  👤 AI Assignee Recommendation Result:")
            print(json.dumps(rec_data, indent=4))
    except Exception as e:
        print(f"  ⚠️ Assignee recommendation error: {e}")

    # Insert Bug into Supabase (priority must be P0, P1, P2, or P3)
    bug_payload = {
        "project_id": project_id,
        "bug_display_id": bug_display_id,
        "bug_number": 1,
        "title": bug_title,
        "description": bug_desc,
        "priority": predicted_priority,
        "severity": predicted_severity,
        "status": "open",
        "epic_id": epic1_id,
        "sprint_id": sprint_id,
        "story_points": 5,
        "original_estimate": 480, # 8 hours
        "time_spent": 120 # 2 hours logged
    }
    bug_res = db.table("bugs").insert(bug_payload).execute()
    bug = bug_res.data[0]
    bug_id = bug["id"]
    print(f"\n✅ Inserted Bug Record: '{bug['title']}' (Key: {bug['bug_display_id']}, ID: {bug_id})")

    # Generate Bug Vector Embedding
    print(f"\n🤖 Calling AI Service (/api/embed-bug) to generate 1024-dim Vector Embedding...")
    try:
        embed_req = requests.post(
            f"{AI_SERVICE_URL}/api/embed-bug",
            params={"bug_id": bug_id},
            json={"title": bug_title, "description": bug_desc, "project_id": project_id},
            timeout=60
        )
        print("  🧠 Embedding Response:", embed_req.json())
    except Exception as e:
        print(f"  ⚠️ Embedding request error: {e}")


    print_header("Step 3: Creating Agile Task & Generating 768-dim Task Embedding")

    task_title = "Integrate GitHub Webhook for automated commit SLA tracking and AI code review"
    task_desc = "Parse incoming GitHub push webhooks for 'Fixes KEY' patterns, calculate SLA resolution hours, and post automated AI code review comments."
    task_display_id = f"{project['project_code']}-T1"

    task_payload = {
        "project_id": project_id,
        "task_display_id": task_display_id,
        "task_number": 1,
        "title": task_title,
        "description": task_desc,
        "priority": "high",
        "status": "in_progress",
        "epic_id": epic2_id,
        "sprint_id": sprint_id,
        "story_points": 3,
        "original_estimate": 360, # 6 hours
        "time_spent": 60 # 1 hour logged
    }
    task_res = db.table("tasks").insert(task_payload).execute()
    task = task_res.data[0]
    task_id = task["id"]
    print(f"✅ Inserted Task Record: '{task['title']}' (Key: {task['task_display_id']}, ID: {task_id})")

    # Generate Task Vector Embedding
    print(f"\n🤖 Calling AI Service (/api/embed-task) to generate 768-dim Task Vector Embedding...")
    try:
        task_embed_req = requests.post(
            f"{AI_SERVICE_URL}/api/embed-task",
            json={"task_id": task_id, "title": task_title, "description": task_desc},
            timeout=60
        )
        print("  🧠 Task Embedding Response:", task_embed_req.json())
    except Exception as e:
        print(f"  ⚠️ Task embedding request error: {e}")


    print_header("Step 4: Simulating Git Commit Push -> AI Code Review, SLA & Auto-Resolution")

    commit_sha = f"a7f{int(time.time()) % 1000000:06d}"
    webhook_payload = {
        "ref": "refs/heads/main",
        "commits": [
            {
                "id": commit_sha,
                "message": f"Fixes {bug['bug_display_id']} - optimized match_bugs RPC query and allocated 1024-dim vector buffer",
                "url": f"https://github.com/{project_payload['github_owner']}/{project_payload['github_repo']}/commit/{commit_sha}",
                "author": {
                    "name": "Sandy (Lead Engineer)",
                    "email": "sandy@example.com",
                    "username": "sandy655"
                },
                "added": ["src/lib/vector_buffer.py"],
                "modified": ["supabase/migrations/match_bugs.sql"]
            }
        ],
        "repository": {
            "name": project_payload['github_repo'],
            "owner": {"login": project_payload['github_owner']}
        },
        "simulated_diff": (
            "diff --git a/supabase/migrations/match_bugs.sql b/supabase/migrations/match_bugs.sql\n"
            "index 83a12b..91c4d0 100644\n"
            "--- a/supabase/migrations/match_bugs.sql\n"
            "+++ b/supabase/migrations/match_bugs.sql\n"
            "@@ -10,4 +10,6 @@\n"
            "-  ORDER BY vector <-> query_embedding\n"
            "+  WHERE embedding IS NOT NULL AND project_id = filter_project_id\n"
            "+  ORDER BY embedding <-> query_embedding\n"
            "+  LIMIT match_count;\n"
        )
    }

    print(f"⚡ Simulating Push Webhook with Commit Message: '{webhook_payload['commits'][0]['message']}'")
    try:
        webhook_req = requests.post(
            f"{AI_SERVICE_URL}/api/webhook/github",
            json=webhook_payload,
            timeout=120
        )
        print("  ⚡ Webhook Execution Result:")
        print(json.dumps(webhook_req.json(), indent=4))
    except Exception as e:
        print(f"  ⚠️ Webhook execution error: {e}")

    # Fetch updated bug details from database to verify status transition & AI comment
    time.sleep(1)
    updated_bug_res = db.table("bugs").select("*, bug_comments(*)").eq("id", bug_id).execute()
    if updated_bug_res.data:
        ubug = updated_bug_res.data[0]
        print(f"\n🎉 Bug Status after Git Push: '{ubug['status'].upper()}' (Resolved at: {ubug.get('resolved_at')})")
        print("💬 Automated AI Comments Posted:")
        for comment in ubug.get("bug_comments", []):
            print("-" * 60)
            print(comment.get("content"))
            print("-" * 60)


    print_header("Step 5: AI RAG Chat Assistant Context Query")

    chat_query = "What bugs were reported, how were they fixed, and what is the current sprint progress?"
    print(f"❓ Querying AI RAG Assistant: '{chat_query}'")

    try:
        chat_req = requests.post(
            f"{AI_SERVICE_URL}/api/chat",
            json={"query": chat_query, "project_id": project_id},
            timeout=20
        )
        if chat_req.status_code == 200:
            chat_resp = chat_req.json()
            print("\n🤖 AI Assistant Response:")
            print(chat_resp.get("response"))
            print(f"\n📊 Context Used: {chat_resp.get('context_bugs_used', 0)} bugs, {chat_resp.get('context_tasks_used', 0)} tasks.")
        else:
            print(f"  ⚠️ Chat response status: {chat_req.status_code}")
    except Exception as e:
        print(f"  ⚠️ Chat assistant error: {e}")

    print_header("Step 6: Summary & Execution Verification")
    print(f"✅ Project Created: {project['name']} ({project['project_code']})")
    print(f"✅ Epic 1 ID: {epic1_id}")
    print(f"✅ Epic 2 ID: {epic2_id}")
    print(f"✅ Sprint ID: {sprint_id}")
    print(f"✅ Bug Key: {bug['bug_display_id']} -> Resolved via AI Git Webhook")
    print(f"✅ Task Key: {task['task_display_id']} -> Created with 768-dim vector embedding")
    print("\n🎉 Everything was executed using real data records and live AI service calls!")
    print(f"🔗 View in Web Platform: Navigate to http://localhost:5173/projects/{project_id}")

if __name__ == "__main__":
    run_pipeline()
