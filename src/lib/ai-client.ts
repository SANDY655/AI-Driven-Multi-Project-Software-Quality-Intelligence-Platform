import { supabase } from './supabase';

const AI_SERVICE_URL = 'http://localhost:8000';

async function getHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
  };
}

export interface BugAnalysisRequest {
  title: string;
  description: string;
  project_id?: string | null;
}

export interface PrioritySeverityPrediction {
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  severity: 'critical' | 'high' | 'medium' | 'low';
  rationale: string;
}

export interface AnalysisResponse {
  prediction: PrioritySeverityPrediction;
  similar_bugs_used: number;
}

export interface DuplicateResponse {
  duplicates: any[];
}

export interface RecommendationResponse {
  recommendation: {
    recommended_developer_id: string;
    rationale: string;
  };
  similar_bugs_used: number;
}

export const aiClient = {
  /**
   * Analyzes a bug to predict Priority and Severity using RAG.
   */
  async analyzeBug(request: BugAnalysisRequest): Promise<AnalysisResponse> {
    const response = await fetch(`${AI_SERVICE_URL}/api/analyze-bug`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        title: request.title,
        description: request.description,
        project_id: request.project_id || null
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Service Error: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Embeds a bug directly (useful for backfilling or bypassing webhooks).
   */
  async embedBug(bugId: string, request: BugAnalysisRequest): Promise<void> {
    const response = await fetch(`${AI_SERVICE_URL}/api/embed-bug?bug_id=${bugId}`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`AI Service Error: ${response.statusText}`);
    }
  },

  /**
   * Embeds a task directly.
   */
  async embedTask(taskId: string, request: { title: string; description: string }): Promise<void> {
    const response = await fetch(`${AI_SERVICE_URL}/api/embed-task`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        task_id: taskId,
        title: request.title,
        description: request.description
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Service Error: ${response.statusText}`);
    }
  },

  /**
   * Detects potential duplicate bugs.
   */
  async detectDuplicates(request: BugAnalysisRequest): Promise<DuplicateResponse> {
    const response = await fetch(`${AI_SERVICE_URL}/api/detect-duplicates`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        title: request.title,
        description: request.description,
        project_id: request.project_id || null
      }),
    });
    if (!response.ok) throw new Error(`AI Service Error: ${response.statusText}`);
    return response.json();
  },

  /**
   * Recommends an assignee for the bug.
   */
  async recommendAssignee(request: BugAnalysisRequest): Promise<RecommendationResponse> {
    const response = await fetch(`${AI_SERVICE_URL}/api/recommend-assignee`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        title: request.title,
        description: request.description,
        project_id: request.project_id || null
      }),
    });
    if (!response.ok) throw new Error(`AI Service Error: ${response.statusText}`);
    return response.json();
  }
};
