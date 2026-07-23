import sys
import os
from dotenv import load_dotenv

load_dotenv('../.env')

from rag_engine import get_embedding, predict_priority_severity, OLLAMA_BASE_URL, EMBEDDING_MODEL, LLM_MODEL

print(f"OLLAMA_BASE_URL: {OLLAMA_BASE_URL}")
print(f"EMBEDDING_MODEL: {EMBEDDING_MODEL}")
print(f"LLM_MODEL: {LLM_MODEL}")

print("Testing get_embedding...")
try:
    embed = get_embedding("Test bug description")
    print("Embedding length:", len(embed))
    if len(embed) == 1024:
        print("mxbai-embed-large-v1 returns 1024-dimensional embeddings usually. If it matches, great.")
except Exception as e:
    print("Error in embedding:", e)

print("\nTesting predict_priority_severity...")
try:
    result = predict_priority_severity("Test Bug", "This is a test bug description", [])
    print("Prediction Result:", result)
except Exception as e:
    print("Error in prediction:", e)
