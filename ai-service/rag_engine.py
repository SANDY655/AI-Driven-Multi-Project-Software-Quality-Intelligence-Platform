import os
import json
import hashlib
import requests
from pydantic import BaseModel, Field

# Local Llama configuration (using Ollama)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "nomic-embed-text")
LLM_MODEL = os.environ.get("LLM_MODEL", "llama2")

print(f"Using Ollama at {OLLAMA_BASE_URL} with embedding model: {EMBEDDING_MODEL}, LLM model: {LLM_MODEL}")

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
        
        # Convert hex to float array (384 dimensions for nomic-embed-text)
        embedding = []
        for i in range(0, 384):
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
    
    prompt = f"""You are an expert software QA engineer. Your task is to analyze a new bug report and assign it a priority and severity.
Use the historical context of similar bugs (if any) and the project details to guide your decision, ensuring consistency with how past bugs were handled.
{project_context}
Historical Context (Similar Bugs):
{context}

New Bug Report:
Title: {bug_title}
Description: {bug_description}

Respond with a JSON object containing exactly these fields:
- priority: one of 'P0', 'P1', 'P2', 'P3'
- severity: one of 'critical', 'high', 'medium', 'low'
- rationale: brief explanation of why this priority/severity was chosen

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
            "rationale": f"Error during analysis: {str(e)}"
        }

def recommend_developer(bug_title: str, bug_description: str, similar_bugs: list, project_details: dict | None = None) -> dict:
    """Uses local Llama model to recommend an assignee based on who fixed similar bugs and project context."""
    context = format_bug_context(similar_bugs)
    
    project_context = ""
    if project_details:
        project_context = f"\nProject Context:\nName: {project_details.get('name')}\nDescription: {project_details.get('description')}\nLanguage/Tech: {project_details.get('github_details', {}).get('language', 'Unknown')}\n"
    
    prompt = f"""You are a technical project manager. Your task is to assign a new bug to the most appropriate developer.
Look at the historical context of similar bugs and see which developer (by UUID) resolved them.
If a particular developer consistently handles this type of issue, recommend them.
{project_context}
Historical Context (Similar Bugs):
{context}

New Bug Report:
Title: {bug_title}
Description: {bug_description}

Respond with a JSON object containing exactly these fields:
- recommended_developer_id: the UUID of the best developer for the job (pick one from the historical bugs or generate a placeholder UUID)
- rationale: brief explanation of why this developer is recommended

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
                "recommended_developer_id": "00000000-0000-0000-0000-000000000000",
                "rationale": "No developer recommendation could be made"
            }
    except Exception as e:
        print(f"Error calling Ollama: {e}")
        return {
            "recommended_developer_id": "00000000-0000-0000-0000-000000000000",
            "rationale": f"Error during recommendation: {str(e)}"
        }
