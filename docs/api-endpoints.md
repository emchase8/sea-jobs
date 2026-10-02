# Mutual Hire HTTP API

This document describes the implemented HTTP contract. All paths are relative to the service root and currently use the `/api` prefix. Requests and responses use JSON unless noted otherwise.

## Authentication and conventions

Except for login and registration, every endpoint requires a DRF token in the request header:

```http
Authorization: Token <token>
Content-Type: application/json
```

Dates use `YYYY-MM-DD`. Money is represented as a two-decimal JSON string. Successful deletes return an empty body. Validation failures use `400 Bad Request`; absent or deliberately hidden resources use `404 Not Found`; missing/invalid authentication uses `401 Unauthorized`. Role-restricted operations also return `401` as required by the product specification.

Vector embeddings are internal implementation data. No endpoint includes an embedding field or embedding values in its response.

## Shared response objects

### Profile

```json
{
  "id": 8,
  "user": {
    "id": 12,
    "username": "alex",
    "email": "alex@example.com",
    "first_name": "Alex",
    "last_name": "Rivera"
  },
  "user_type": "applicant",
  "description": "Python developer"
}
```

`user_type` is either `applicant` or `recruiter`; `description` may be `null`.

### Job

```json
{
  "id": 21,
  "title": "Backend Engineer",
  "company": {
    "id": 7,
    "username": "acme",
    "email": "jobs@acme.example",
    "first_name": "",
    "last_name": ""
  },
  "location": "Denver, CO",
  "pay": "105000.00",
  "type": "full_time",
  "description": "Build and operate Django services.",
  "skills": ["Python", "Django"]
}
```

`type` is `internship`, `part_time`, or `full_time`.

### Resume

```json
{
  "id": 31,
  "owner": {
    "id": 12,
    "username": "alex",
    "email": "alex@example.com",
    "first_name": "Alex",
    "last_name": "Rivera"
  },
  "summary": "Backend developer",
  "experience": [
    {
      "id": 40,
      "title": "Engineer",
      "company": "Example Co",
      "start_date": "2023-01-15",
      "end_date": null,
      "current_job": true,
      "description": "Built APIs.",
      "type": "job"
    }
  ],
  "education": [
    {
      "id": 50,
      "title": "State University",
      "degree": "BS",
      "major": "Computer Science",
      "gpa": "3.75",
      "start_date": "2019-09-01",
      "end_date": "2023-05-15",
      "description": ""
    }
  ],
  "skills": ["Python", "PostgreSQL"]
}
```

Experience `type` is `job` or `project`. `gpa` may be `null` and must be between 0 and 4. `end_date` may be `null`; a current job must have a null `end_date`.

## Authentication endpoints

### Log in

`POST /api/auth/login/`

Authentication is not required. Supply both fields:

```json
{"username": "alex", "password": "secret"}
```

Returns `200 OK` with a token and the complete Profile object:

```json
{"token": "0123456789abcdef", "profile": {"id": 8, "user": {}, "user_type": "applicant", "description": "Python developer"}}
```

Returns `400` when a field is missing and `401` when credentials are invalid or the Django user has no API profile.

### Register and log in

`POST /api/auth/register/{user_type}/`

Authentication is not required. `user_type` must be `applicant` or `recruiter`.

```json
{
  "username": "alex",
  "email": "alex@example.com",
  "first_name": "Alex",
  "last_name": "Rivera",
  "password": "a-valid-password",
  "description": "Python developer"
}
```

`username` and `password` are required. The remaining fields are optional; `description` may be null. Password validation follows the configured Django password validators. Returns `201 Created` with the same `{token, profile}` shape as login. Returns `400` for invalid data, an unsupported user type, a duplicate username, or a rejected password.

## User endpoints

### Get a user

`GET /api/user/{user_id}/`

Returns `200 OK` with the Profile object for any existing profile. Returns `404` if it does not exist.

### Get the current applicant

`GET /api/user/`

Returns `200 OK` with the authenticated applicant's Profile object. Returns `401` when the authenticated user is not an applicant.

### Delete the current user

`DELETE /api/user/`

Deletes the authenticated Django user. Its profile, jobs, resume, and other dependent records are removed by database cascade. Returns `204 No Content`.

### Get a user's resume

`GET /api/user/{user_id}/resume/`

Returns `200 OK` with the user's Resume object. Returns `404` when the user is not an applicant, has no resume, or does not exist.

## Job endpoints

### Get a job

`GET /api/job/{job_id}/`

Returns `200 OK` with a Job object or `404` when no such job exists.

### List the current recruiter's jobs

`GET /api/job/`

Returns `200 OK` with an array of Job objects owned by the authenticated recruiter, ordered by ID. Returns `401` for an applicant.

### Create a job

`POST /api/job/`

Recruiter only. All request fields are required:

```json
{
  "title": "Backend Engineer",
  "location": "Denver, CO",
  "pay": "105000.00",
  "type": "full_time",
  "description": "Build and operate Django services.",
  "skills": ["Python", "Django"]
}
```

The authenticated user becomes `company`; clients cannot choose it. Returns `201 Created` with the new Job object, `400` for invalid or missing fields, or `401` for a non-recruiter.

### Update a job

`POST /api/job/{job_id}/`

Recruiter and owner only. Include any subset of the create fields. When `skills` is supplied, it replaces the complete skill list; when omitted, existing skills remain unchanged. Returns `200 OK` with the updated Job object. Returns `404` both when the job is absent and when it belongs to another user, preventing ownership disclosure.

### Update a job description

`POST /api/job/{job_id}/description/`

Recruiter and owner only. Updates only the job description:

```json
{"description": "Build and operate Django services for high-volume hiring workflows."}
```

Returns `200 OK` with the updated Job object, `400` for an invalid or missing description, or `401` for a non-recruiter. Returns `404` both when the job is absent and when it belongs to another user, preventing ownership disclosure.

### Delete a job

`DELETE /api/job/{job_id}/`

Recruiter ownership is enforced by the resource lookup. Returns `204 No Content`, or `404` when the job is absent or belongs to another user.

## Resume endpoints

### Get a resume

`GET /api/resume/{resume_id}/`

Returns `200 OK` with a Resume object or `404` when it does not exist.

### Create a resume

`POST /api/resume/`

Applicant only. All top-level fields and all fields shown below are required except nullable/blank model fields:

```json
{
  "summary": "Backend developer",
  "experience": [
    {
      "title": "Engineer",
      "company": "Example Co",
      "start_date": "2023-01-15",
      "end_date": null,
      "current_job": true,
      "description": "Built APIs.",
      "type": "job"
    }
  ],
  "education": [
    {
      "title": "State University",
      "degree": "BS",
      "major": "Computer Science",
      "gpa": "3.75",
      "start_date": "2019-09-01",
      "end_date": "2023-05-15",
      "description": ""
    }
  ],
  "skills": ["Python", "PostgreSQL"]
}
```

Returns `201 Created` with the Resume object. Because a resume owner is one-to-one, creating a second resume returns `409 Conflict`. Invalid data returns `400`; a recruiter receives `401`.

### Update a resume

`POST /api/resume/{resume_id}/`

Applicant and owner only. Include any subset of the create fields. Each supplied collection (`experience`, `education`, or `skills`) replaces that complete collection atomically; omitted collections remain unchanged. Returns `200 OK` with the updated Resume object. Returns `404` when the resume is absent or owned by another applicant.

### Upload a PDF resume

`POST /api/resume/upload/`

Applicant only. Uses multipart form data with a required PDF file field named `file`:

```http
Authorization: Token <token>
Content-Type: multipart/form-data
```

The uploaded PDF is parsed into the same Resume fields used by the create and update endpoints. If the authenticated applicant does not have a resume, the endpoint creates one and returns `201 Created` with the Resume object. If the applicant already has a resume, the endpoint replaces the resume summary, experience, education, and skills with the parsed PDF values and returns `200 OK` with the updated Resume object.

Returns `400` when the file is missing, is not a PDF, cannot be parsed, or produces invalid resume data. Returns `401` for a recruiter. The server requires `ANTHROPIC_API_KEY` to parse PDF resumes. Set `ANTHROPIC_MODELS` to a comma-separated list to override the default Anthropic fallback models.

## Matching endpoints

### Get matching resumes

`GET /api/matching/resumes/?job_id={job_id}`

Returns `200 OK` with up to 10 Resume objects ranked for the specified job. Previously employer-swiped resumes are excluded. Returns `400` when `job_id` is omitted and `404` when the job does not exist.

### Get matching jobs

`GET /api/matching/jobs/?resume_id={resume_id}`

Returns `200 OK` with up to 10 Job objects ranked for the specified resume. Previously applicant-swiped jobs are excluded. Returns `400` when `resume_id` is omitted and `404` when the resume does not exist.

Both matching responses use the shared public objects above and never expose the embeddings used to calculate similarity.

## Mutual match endpoints

A mutual match is a job-resume relationship where both the applicant and the
employer have swiped yes. Match responses omit the internal swipe fields and use
this shape:

```json
{
  "id": 61,
  "job": {"id": 21, "title": "Backend Engineer", "skills": ["Python"]},
  "resume": {"id": 31, "summary": "Backend developer", "skills": ["Python"]},
  "created_at": "2026-09-01T18:42:17.120000Z"
}
```

The embedded `job` and `resume` values are the complete public Job and Resume
objects described above. They never contain vector embeddings.

### List an applicant's mutual matches

`GET /api/matches/applicant/`

Applicant only. The resume is resolved from the authenticated user; no resume ID
is required. Returns `200 OK` with an array of Match objects for which both
parties expressed interest. The array is empty when there are no mutual matches.
Returns `401` when the authenticated user is not an applicant and `404` when the
applicant does not have a resume.

### List a recruiter's mutual matches

`GET /api/matches/recruiter/{job_id}/`

Recruiter and job owner only. Returns `200 OK` with an array of Match objects for
which both parties expressed interest. The array is empty when there are no
mutual matches. Returns `401` when the authenticated user is not a recruiter,
`404` when the job does not exist, and `403` when it belongs to another
recruiter.
