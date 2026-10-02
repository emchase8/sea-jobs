# Sea Jobs

Sea Jobs is a full-stack job matching project with a Django REST backend and a React/Vite frontend. Applicants can create resumes, recruiters can create jobs, and both sides can review matches using swipe-style workflows. The backend also supports peer networking matches and AI-assisted resume/job messaging features.

## Project Structure

- `backend/` - Django project settings, URL routing, ASGI, and WSGI entry points.
- `api/` - Django REST API app with models, serializers, views, migrations, matching logic, and import/simulation commands.
- `frontend/` - React app built with Vite.
- `shared/` - Shared TypeScript domain models consumed by the frontend.
- `docs/` - Extra project documentation, including API and database notes.
- `docker-compose.yml` - Local PostgreSQL database with the pgvector extension.
- `test_jobs.csv` and `test_resumes.csv` - Sample data for import/testing workflows.

## Prerequisites

- Python 3.12 or newer
- Node.js and npm
- Docker Desktop, or another Docker-compatible runtime
- OpenAI API key for embeddings
- Anthropic API key for resume parsing and generated message suggestions

## Environment Variables

Create a `.env` file in the project root. The database values below match `docker-compose.yml`:

```env
DB_NAME=sea_jobs_db
DB_USER=sea_jobs_user
DB_PASSWORD=<avaliable upon request>
DB_HOST=localhost
DB_PORT=5432
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
# Optional: comma-separated fallback models for Anthropic calls
ANTHROPIC_MODELS=
```

`OPENAI_API_KEY` is used to generate vector embeddings for jobs and resumes. `ANTHROPIC_API_KEY` is used for PDF resume parsing and draft message suggestions.

## Start the Backend

From the project root:

```bash
docker compose up -d
```

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Apply database migrations:

```bash
python3 manage.py migrate
```

Start the Django development server:

```bash
python3 manage.py runserver
```

The backend runs at `http://localhost:8000`. API endpoints are served under `http://localhost:8000/api/`.

## Start the Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. The React app currently calls the backend directly at `http://localhost:8000` or `http://127.0.0.1:8000`, so keep the Django server running while using the frontend.

## Useful Backend Commands

Run tests:

```bash
python3 manage.py test
```

Import sample jobs:

```bash
python3 manage.py import_jobs test_jobs.csv
```

Import sample resumes:

```bash
python3 manage.py import_resumes test_resumes.csv
```

Generate simulated match data:

```bash
python3 manage.py simulate_matches
python3 manage.py simulate_network_matches
```

## Useful Frontend Commands

Run the development server:

```bash
npm run dev
```

Run ESLint:

```bash
npm run lint
```

Build production assets:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

## Project Basics

The backend uses Django REST Framework with token authentication. Login and registration are public; most other endpoints require an `Authorization: Token <token>` header.

Core domain models include:

- `UserProfile` - attaches an applicant or recruiter role to a Django user.
- `Job` - recruiter-owned job posts with title, company, location, pay, type, description, skills, and a description embedding.
- `Resume` - applicant-owned resume with summary, skills, education, experience, and section embeddings.
- `Match` - applicant/recruiter match state for jobs and resumes.
- `NetworkMatch` - peer-to-peer applicant networking match state.

The frontend is organized around pages for authentication, resumes, jobs, matching, interested/matched results, networking, account management, and the main menu layout.

See `docs/api-endpoints.md` for the implemented HTTP contract and `docs/db.md` for database design notes.
