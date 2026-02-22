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
* A Supabase account and project
* A GitHub account (for OAuth and API integration)

### 1. Clone the repository
```bash
git clone https://github.com/SANDY655/AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform.git
cd AI-Driven-Multi-Project-Software-Quality-Intelligence-Platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and add your Supabase credentials. You can duplicate `.env.example`:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Database Setup
The database schema, RLS policies, and triggers are located in `supabase/migrations/0000_initial.sql`.
Execute this SQL script directly in your Supabase SQL Editor to instantly generate all 10 required tables and the strict security policies.

### 5. Start the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

## 🔒 Database & Security Schema
This project utilizes **Supabase Row Level Security (RLS)** as a core architectural pattern to ensure multi-tenant security in a serverless environment. 
* Users can only `SELECT` projects they are physically a member of.
* Only project `admin` or `pm` roles can modify project settings, transition bugs across the Kanban board, or invite new members.
* `SECURITY DEFINER` Postgres functions are utilized to securely check ownership status without triggering infinite recursion loops.

## 📝 License
This Capstone Project is licensed under the MIT License.
