// Utility to call the local Python FastAPI AI Service

const AI_SERVICE_URL = 'http://localhost:8000';

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
      headers: {
        'Content-Type': 'application/json',
      },
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
