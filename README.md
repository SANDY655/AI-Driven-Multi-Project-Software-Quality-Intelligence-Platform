# AI-Driven Multi-Project Software Quality Intelligence Platform

A modern, full-stack bug tracking and project management platform built to integrate seamlessly with GitHub. This capstone project aims to revolutionize software lifecycle management by combining traditional Kanban-style bug tracking with advanced, predictive Artificial Intelligence.

## 🚀 Core Features

### Phase 1: Foundation & Authentication (Implemented)
* **Secure Authentication**: Built-in Email/Password and GitHub OAuth authorization via Supabase Auth.
* **Role-Based Access Control (RBAC)**: Multi-tenant security enforced via strict Supabase Row Level Security (RLS). Users are assigned specific global and project-level roles: `admin`, `pm`, `developer`, `tester`, and `viewer`.
* **Dynamic Protected Routing**: React Router implementation securely handling authenticated state.
* **Modern UI/UX**: Built with Tailwind CSS, shadcn/ui components, and Lucide React icons for a premium, responsive feel.

### Phase 2: Project Management & GitHub Integration (Implemented)
* **Project Dashboard**: A centralized hub to view active projects, bug counts, and team assignments.
* **Live GitHub Sync**: Automatically fetches repository metadata (Stars, Forks, Open Issues, Language) and Top Contributors using the GitHub REST API (Octokit).
* **Supabase Edge Functions**: Webhook listener designed to parse GitHub `push` events, extract Bug IDs from commit messages (e.g., `Fixes BUG-PRJ-123`), and automatically link codebase commits directly to bug tickets in the database.

### Phase 3: Comprehensive Bug Tracking (Upcoming)
* **Ticket Lifecycle Management**: Full CRUD operations for Bugs (Draft, Open, In Progress, In Review, Resolved, Closed).
* **Kanban Workflow**: A drag-and-drop interactive board for visualizing sprint progress and dispatcher assignments.
* **Granular Issue Activity**: Comments, attachments, and an immutable activity timeline tracking all status changes and linked GitHub commits.
* **Team Assignment**: Invite-based workflow allowing Admins to pull Developers and Testers into specific project scopes.

### Phase 4: AI Software Quality Intelligence (Upcoming)
The pinnacle of this Capstone project introduces cutting-edge AI features:
* **Predictive Defect Analytics**: Machine Learning models applied to historical bug data to predict high-risk areas of the codebase.
* **Automated AI Triage**: Natural Language Processing (NLP) to read incoming bug reports, categorize them, suggest severity, and recommend an assignee based on past commit history.
* **Automated Code Review Assistant**: LLM-powered review of linked GitHub commits to provide instant feedback on whether the code safely resolves the logged bug without introducing regressions.
* **RAG Semantic Search**: Ability to ask natural language questions (e.g., "Which component has been causing the most memory leaks?") by vectorizing past bug resolutions and project metadata.

## 🛠️ Tech Stack Architecture

* **Frontend**: React 18, Vite, TypeScript
* **Styling**: Tailwind CSS, shadcn/ui, PostCSS
* **Routing & State**: React Router DOM, React Context API
* **Backend Database**: Supabase (PostgreSQL 15)
* **Backend Compute**: Supabase Edge Functions (Deno)
* **External APIs**: Octokit (GitHub REST API v3)
* **Form Handling & Validation**: React Hook Form, Zod

## ⚙️ Local Development Setup

### Prerequisites
* Node.js (v18 or higher)
* Python 3.10+ (for the AI Service)
* [Ollama](https://ollama.ai/) installed locally
* A Supabase account and project (with `pgvector` extension enabled)
* A GitHub account (for OAuth and API integration)

### 1. Clone the repository
```bash
git clone https://github.com/SANDY655/AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform.git
cd AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform
```

### 2. Frontend Setup
Install frontend dependencies:
```bash
npm install
```

### 3. AI Backend Service Setup
Navigate to the `ai-service` directory and install Python dependencies:
```bash
cd ai-service
pip install -r requirements.txt
```

Download the required local AI models using Ollama:
```bash
ollama pull llama3.2:latest
ollama pull nomic-embed-text
```

### 4. Environment Variables
Create a `.env` file in the root directory and add the following credentials:
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.2:latest
```

### 5. Database Setup
Ensure that the `vector` extension is enabled in your Supabase project (Database -> Extensions -> `vector`).
Navigate to the `supabase/migrations/` folder and execute the SQL scripts in your Supabase SQL Editor in the following order:
1. `0000_initial.sql`
2. `0001_add_bug_comments_policies.sql`
3. `0002_fix_roles_and_add_delete_policy.sql`
4. `0003_rbac_enforcement.sql`
5. `0004_create_tasks_table.sql`
6. `20240723000001_add_pgvector.sql`
7. `20240730000001_add_task_embedding.sql`
8. `20240730000002_add_sla_and_task_commits.sql`

### 6. Start the Servers
You need to run both the frontend and backend servers simultaneously.

**Terminal 1 (Frontend):**
```bash
# From the root directory
npm run dev
```

**Terminal 2 (AI Service):**
```bash
# From the ai-service directory
uvicorn main:app --reload
```

Navigate to `http://localhost:5173` in your browser.

## 🔒 Database & Security Schema
This project utilizes **Supabase Row Level Security (RLS)** as a core architectural pattern to ensure multi-tenant security in a serverless environment. 
* Users can only `SELECT` projects they are physically a member of.
* Only project `admin` or `pm` roles can modify project settings, transition bugs across the Kanban board, or invite new members.
* `SECURITY DEFINER` Postgres functions are utilized to securely check ownership status without triggering infinite recursion loops.

## 📝 License
This Capstone Project is licensed under the MIT License.
