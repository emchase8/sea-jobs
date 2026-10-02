import base64
import json
import re
try:
    import anthropic
except ImportError:
    anthropic = None
import requests
from decouple import config
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .matching import find_matching_jobs_for_resume, find_matching_resumes_for_job, find_matching_peers_for_resume
from .models import Job, Match, NetworkMatch, Resume, UserProfile, UserType
from .serializers import (
    JobSerializer,
    MatchSerializer,
    NetworkMatchSerializer,
    RegisterSerializer,
    ResumeSerializer,
    UserProfileSerializer,
)


def unauthorized(message):
    return Response({"detail": message}, status=status.HTTP_401_UNAUTHORIZED)


def auth_payload(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {"token": token.key, "profile": UserProfileSerializer(user.profile).data}


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        if not username or not password:
            raise serializers.ValidationError({"detail": "Both username and password are required."})
        user = authenticate(request=request, username=username, password=password)
        if user is None:
            return unauthorized("Invalid username or password.")
        if not hasattr(user, "profile"):
            return unauthorized("This user does not have an API profile.")
        return Response(auth_payload(user))


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, user_type):
        serializer = RegisterSerializer(data=request.data, context={"user_type": user_type})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(auth_payload(user), status=status.HTTP_201_CREATED)


class UserView(APIView):
    def get(self, request, user_id=None):
        if user_id is None:
            profile = get_object_or_404(UserProfile, user=request.user)
            if profile.user_type != UserType.APPLICANT:
                return unauthorized("Only applicants can retrieve their own profile here.")
        else:
            profile = get_object_or_404(UserProfile.objects.select_related("user"), user_id=user_id)
        return Response(UserProfileSerializer(profile).data)

    def delete(self, request, user_id=None):
        if user_id is not None:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserResumeView(APIView):
    def get(self, request, user_id):
        resume = get_object_or_404(
            Resume.objects.select_related("owner", "owner__profile"),
            owner_id=user_id,
            owner__profile__user_type=UserType.APPLICANT,
        )
        return Response(ResumeSerializer(resume).data)


class JobView(APIView):
    def get(self, request, job_id=None):
        if job_id is not None:
            return Response(JobSerializer(get_object_or_404(Job, pk=job_id)).data)
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.RECRUITER:
            return unauthorized("Only recruiters can list their jobs.")
        jobs = Job.objects.filter(company=request.user).order_by("id")
        return Response(JobSerializer(jobs, many=True).data)

    def post(self, request, job_id=None):
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.RECRUITER:
            return unauthorized("Only recruiters can create or update jobs.")
        job = get_object_or_404(Job, pk=job_id, company=request.user) if job_id is not None else None
        serializer = JobSerializer(job, data=request.data, partial=job is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save(company=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK if job else status.HTTP_201_CREATED)

    def delete(self, request, job_id=None):
        if job_id is None:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        job = get_object_or_404(Job, pk=job_id, company=request.user)
        job.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResumeView(APIView):
    def get(self, request, resume_id=None):
        if resume_id is None:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        return Response(ResumeSerializer(get_object_or_404(Resume, pk=resume_id)).data)

    def post(self, request, resume_id=None):
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.APPLICANT:
            return unauthorized("Only applicants can create or update resumes.")
        if resume_id is None:
            if Resume.objects.filter(owner=request.user).exists():
                return Response({"detail": "This applicant already has a resume."}, status=status.HTTP_409_CONFLICT)
            resume = None
        else:
            resume = get_object_or_404(Resume, pk=resume_id, owner=request.user)
        serializer = ResumeSerializer(resume, data=request.data, partial=resume is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK if resume else status.HTTP_201_CREATED)


def _clean_json_response(response_text):
    clean_text = response_text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    if clean_text.startswith("```"):
        clean_text = clean_text[3:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    return json.loads(clean_text.strip())


def _coerce_resume_date(value):
    if value is None:
        return None
    value = str(value).strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    if re.fullmatch(r"\d{4}-\d{2}", value):
        return f"{value}-01"
    if re.fullmatch(r"\d{4}", value):
        return f"{value}-01-01"
    return None


def _coerce_gpa(value):
    if value in (None, ""):
        return None
    try:
        gpa = float(value)
    except (TypeError, ValueError):
        return None
    if gpa < 0 or gpa > 4:
        return None
    return f"{gpa:.2f}"


def normalize_parsed_resume(parsed_resume):
    if not isinstance(parsed_resume, dict):
        raise serializers.ValidationError({"file": "The PDF parser did not return a resume object."})

    raw_skills = parsed_resume.get("skills", [])
    if isinstance(raw_skills, str):
        raw_skills = [skill.strip() for skill in raw_skills.split(",")]

    normalized = {
        "summary": str(parsed_resume.get("summary") or "Resume parsed from PDF.").strip(),
        "experience": [],
        "education": [],
        "skills": [str(skill).strip() for skill in raw_skills if str(skill).strip()],
    }

    raw_experience = parsed_resume.get("experience", parsed_resume.get("experiences", []))
    for entry in raw_experience if isinstance(raw_experience, list) else []:
        if not isinstance(entry, dict):
            continue
        start_date = _coerce_resume_date(entry.get("start_date")) or "1900-01-01"
        end_date = _coerce_resume_date(entry.get("end_date"))
        current_job = bool(entry.get("current_job")) or end_date is None
        entry_type = entry.get("type") if entry.get("type") in ("job", "project") else "job"
        normalized["experience"].append(
            {
                "title": str(entry.get("title") or "Experience").strip(),
                "company": str(entry.get("company") or "").strip(),
                "start_date": start_date,
                "end_date": None if current_job else end_date,
                "current_job": current_job,
                "description": str(entry.get("description") or "").strip(),
                "type": entry_type,
            }
        )

    raw_education = parsed_resume.get("education", [])
    for entry in raw_education if isinstance(raw_education, list) else []:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or entry.get("school") or "").strip()
        if not title:
            continue
        normalized["education"].append(
            {
                "title": title,
                "degree": str(entry.get("degree") or "Not specified").strip(),
                "major": str(entry.get("major") or "Not specified").strip(),
                "gpa": _coerce_gpa(entry.get("gpa")),
                "start_date": _coerce_resume_date(entry.get("start_date")) or "1900-01-01",
                "end_date": _coerce_resume_date(entry.get("end_date")),
                "description": str(entry.get("description") or "").strip(),
            }
        )

    return normalized


def _anthropic_content_text(message):
    content = message["content"] if isinstance(message, dict) else message.content
    text_parts = []
    for block in content:
        block_type = block.get("type") if isinstance(block, dict) else getattr(block, "type", None)
        block_text = block.get("text") if isinstance(block, dict) else getattr(block, "text", "")
        if block_type == "text" and block_text:
            text_parts.append(block_text)
    return "\n".join(text_parts).strip()


def _anthropic_models():
    configured_models = config("ANTHROPIC_MODELS", default="")
    if configured_models:
        return [model.strip() for model in configured_models.split(",") if model.strip()]
    return ["claude-sonnet-5-5", "claude-sonnet-5", "claude-haiku-4-5"]


def _create_anthropic_message(api_key, model_name, system_prompt, pdf_data, user_message):
    content = [
        {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": pdf_data,
            },
        },
        {"type": "text", "text": user_message},
    ]

    if anthropic is not None:
        client = anthropic.Anthropic(api_key=api_key)
        return client.messages.create(
            model=model_name,
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": content}],
        )

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model_name,
            "max_tokens": 4000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": content}],
        },
        timeout=60,
    )
    if not response.ok:
        raise ValueError(f"Anthropic API returned {response.status_code}: {response.text}")
    return response.json()


def parse_resume_pdf_with_anthropic(uploaded_file):
    api_key = config("ANTHROPIC_API_KEY", default="")
    if not api_key:
        raise serializers.ValidationError({"file": "ANTHROPIC_API_KEY is not configured."})

    pdf_bytes = uploaded_file.read()
    uploaded_file.seek(0)
    if not pdf_bytes:
        raise serializers.ValidationError({"file": "The uploaded PDF is empty."})

    system_prompt = (
        "You convert resume PDFs into strict JSON for an applicant tracking system. "
        "Return ONLY valid JSON. Do not include markdown fences or commentary. "
        "Use this exact shape: "
        "{\"summary\":\"string\",\"experience\":[{\"title\":\"string\",\"company\":\"string\","
        "\"start_date\":\"YYYY-MM-DD\",\"end_date\":null,\"current_job\":true,"
        "\"description\":\"string\",\"type\":\"job\"}],"
        "\"education\":[{\"title\":\"string\",\"degree\":\"string\",\"major\":\"string\","
        "\"gpa\":null,\"start_date\":\"YYYY-MM-DD\",\"end_date\":null,\"description\":\"string\"}],"
        "\"skills\":[\"string\"]}. "
        "Experience type must be either \"job\" or \"project\". "
        "Use null for unknown optional end dates or GPA. "
        "For unknown required dates, use the first day of the known month or year. "
        "For missing required strings, use an empty string only when the PDF truly does not provide the value."
    )
    user_message = (
        "Parse this PDF resume into the JSON shape from the system instructions. "
        "Summarize the candidate in one concise paragraph using only resume evidence."
    )

    models_to_try = _anthropic_models()
    response_text = None
    last_error = None
    pdf_data = base64.b64encode(pdf_bytes).decode("utf-8")
    for model_name in models_to_try:
        try:
            msg = _create_anthropic_message(api_key, model_name, system_prompt, pdf_data, user_message)
            response_text = _anthropic_content_text(msg)
            break
        except Exception as exc:
            last_error = exc
            continue

    if not response_text:
        attempted_models = ", ".join(models_to_try)
        raise serializers.ValidationError(
            {"file": f"Failed to parse the PDF resume with {attempted_models}: {last_error}"}
        )

    try:
        parsed_json = _clean_json_response(response_text)
    except Exception as exc:
        raise serializers.ValidationError({"file": f"The PDF parser returned invalid JSON: {exc}"})
    return normalize_parsed_resume(parsed_json)


class ResumeUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.APPLICANT:
            return unauthorized("Only applicants can create or update resumes.")

        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise serializers.ValidationError({"file": "A PDF file is required."})
        is_pdf_content = uploaded_file.content_type == "application/pdf"
        is_pdf_name = uploaded_file.name.lower().endswith(".pdf")
        if not is_pdf_content and not is_pdf_name:
            raise serializers.ValidationError({"file": "Only PDF files are supported."})

        parsed_resume = parse_resume_pdf_with_anthropic(uploaded_file)
        try:
            resume = request.user.resumes
        except Resume.DoesNotExist:
            resume = None

        serializer = ResumeSerializer(resume, data=parsed_resume, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK if resume else status.HTTP_201_CREATED)


class MatchingResumes(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        job_id = request.query_params.get("job_id")
        if not job_id:
            raise serializers.ValidationError({"job_id": "This query parameter is required."})
        job = get_object_or_404(Job, pk=job_id)
        return Response(ResumeSerializer(find_matching_resumes_for_job(job), many=True).data)


class MatchingJobs(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resume = request.user.resumes 
        except Resume.DoesNotExist:
            return Response(
                {"error": "You do not have a resume set up yet."}, 
                status=status.HTTP_404_NOT_FOUND
            )

        ranked_jobs = find_matching_jobs_for_resume(resume)

        serializer = JobSerializer(ranked_jobs, many=True)
        
        return Response(serializer.data, status=status.HTTP_200_OK)

class SwipeView(APIView):
    permission_classes = [IsAuthenticated] 

    def post(self, request):
        job_id = request.data.get('job_id')
        is_interested = request.data.get('is_interested') 

        if job_id is None or is_interested is None:
            return Response(
                {"error": "job_id and is_interested are required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        user_profile = request.user.profile

        # Automatically get resume_id if an applicant is swiping
        if user_profile.user_type == UserType.APPLICANT:
            try:
                resume_id = request.user.resumes.id
            except Resume.DoesNotExist:
                return Response({"error": "You do not have a resume set up yet."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Recruiters pass resume_id from the card
            resume_id = request.data.get('resume_id')
            if resume_id is None:
                return Response({"error": "resume_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        match_record, created = Match.objects.get_or_create(
            job_id=job_id, 
            resume_id=resume_id
        )

        if user_profile.user_type == UserType.APPLICANT:
            match_record.applicant_swiped_yes = is_interested
        elif user_profile.user_type == UserType.RECRUITER:
            if match_record.job.company != request.user:
                return Response({"error": "You don't own this job."}, status=status.HTTP_403_FORBIDDEN)
            match_record.employer_swiped_yes = is_interested

        match_record.save()

        is_mutual_match = (
            match_record.applicant_swiped_yes is True and 
            match_record.employer_swiped_yes is True
        )

        return Response({
            "message": "Swipe recorded successfully.",
            "is_mutual_match": is_mutual_match
        }, status=status.HTTP_200_OK)

class GetMatchesForJobView(APIView):
    def get(self, request, job_id):
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.RECRUITER:
            return unauthorized("Only recruiters can search job matches.")

        job = get_object_or_404(Job, pk=job_id)
        if job.company != request.user:
            return Response({"error": "You don't own this job."}, status=status.HTTP_403_FORBIDDEN)

        return Response(
            MatchSerializer(Match.objects.filter(
                job=job,
                applicant_swiped_yes=True,
                employer_swiped_yes=True
            ), many=True).data, status=status.HTTP_200_OK
        )

class GetMatchesForResumeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = get_object_or_404(UserProfile, user=request.user)
        if profile.user_type != UserType.APPLICANT:
            return unauthorized("Only applicants can search job matches.")

        try:
            resume = request.user.resumes
        except Resume.DoesNotExist:
            return Response([], status=status.HTTP_200_OK)

        matches = Match.objects.filter(
            resume=resume,
            applicant_swiped_yes=True,
        ).select_related("job", "job__company", "resume", "resume__owner").order_by("-created_at")

        return Response(MatchSerializer(matches, many=True).data, status=status.HTTP_200_OK)


class DraftMessageSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        job_id = request.data.get("job_id")
        match_id = request.data.get("match_id")

        if not job_id and not match_id:
            return Response({"error": "job_id or match_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_profile = request.user.profile

        if match_id:
            match_obj = get_object_or_404(Match, pk=match_id)
            job = match_obj.job
            resume = match_obj.resume
        else:
            job = get_object_or_404(Job, pk=job_id)
            if user_profile.user_type == UserType.APPLICANT:
                try:
                    resume = request.user.resumes
                except Resume.DoesNotExist:
                    return Response({"error": "You do not have a resume set up yet."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                resume_id = request.data.get("resume_id")
                if not resume_id:
                    return Response({"error": "resume_id is required for recruiters."}, status=status.HTTP_400_BAD_REQUEST)
                resume = get_object_or_404(Resume, pk=resume_id)

        job_skills = list(job.skills.values_list("skill", flat=True))
        resume_skills = list(resume.skills.values_list("skill", flat=True))
        resume_experiences = [
            f"{exp.title} at {exp.company} ({exp.description})"
            for exp in resume.experiences.all()
        ]
        resume_education = [
            f"{edu.degree} in {edu.major} from {edu.title}"
            for edu in resume.education.all()
        ]

        applicant_name = f"{resume.owner.first_name} {resume.owner.last_name}".strip() or resume.owner.username
        company_name = job.company.first_name or job.company.username

        api_key = config("ANTHROPIC_API_KEY", default="")
        if anthropic is None:
            return Response({"error": "The anthropic package is not installed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        if not api_key:
            return Response({"error": "ANTHROPIC_API_KEY is not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            client = anthropic.Anthropic(api_key=api_key)

            if user_profile.user_type == UserType.APPLICANT:
                system_prompt = (
                    "You are an expert career advisor. Your goal is to give job applicants concise, practical, "
                    "and highly actionable suggestions on what to say when emailing a recruiter or hiring manager. "
                    "Do NOT write the full email message. Instead, provide 3 to 5 clear bullet points advising the applicant "
                    "on what points, experiences, or questions to include so they can write the message themselves. "
                    "Format each suggestion as an actionable recommendation (e.g. 'Email the recruiter mentioning your experience with...', "
                    "'Highlight your project involving...', 'Ask the recruiter about...'). "
                    "Output ONLY valid JSON in the format: {\"suggestions\": [\"...\", \"...\"]}"
                )
                user_message = (
                    f"Job Title: {job.title}\n"
                    f"Company: {company_name}\n"
                    f"Location: {job.location}\n"
                    f"Job Description: {job.description}\n"
                    f"Required Skills: {', '.join(job_skills)}\n\n"
                    f"Applicant Name: {applicant_name}\n"
                    f"Applicant Summary: {resume.summary}\n"
                    f"Applicant Skills: {', '.join(resume_skills)}\n"
                    f"Applicant Experience: {'; '.join(resume_experiences)}\n"
                    f"Applicant Education: {'; '.join(resume_education)}\n"
                )
            else:
                system_prompt = (
                    "You are an expert recruitment advisor. Your goal is to give hiring managers/recruiters concise, "
                    "practical, and actionable suggestions on what to say when reaching out to an applicant who matched with their job. "
                    "Do NOT write the full message. Instead, provide 3 to 5 clear bullet points advising the recruiter "
                    "on what points or questions to include so they can write the message themselves. "
                    "Output ONLY valid JSON in the format: {\"suggestions\": [\"...\", \"...\"]}"
                )
                user_message = (
                    f"Job Title: {job.title}\n"
                    f"Job Description: {job.description}\n"
                    f"Applicant Name: {applicant_name}\n"
                    f"Applicant Summary: {resume.summary}\n"
                    f"Applicant Skills: {', '.join(resume_skills)}\n"
                    f"Applicant Experience: {'; '.join(resume_experiences)}\n"
                )

            models_to_try = _anthropic_models()
            response_text = None
            for model_name in models_to_try:
                try:
                    msg = client.messages.create(
                        model=model_name,
                        max_tokens=600,
                        system=system_prompt,
                        messages=[{"role": "user", "content": user_message}],
                    )
                    response_text = msg.content[0].text
                    break
                except Exception:
                    continue

            if not response_text:
                return Response({"error": "Failed to generate suggestions from AI."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            try:
                clean_text = response_text.strip()
                if clean_text.startswith("```json"):
                    clean_text = clean_text[7:]
                if clean_text.startswith("```"):
                    clean_text = clean_text[3:]
                if clean_text.endswith("```"):
                    clean_text = clean_text[:-3]
                parsed = json.loads(clean_text.strip())
                suggestions = parsed.get("suggestions", [])
            except Exception:
                suggestions = [
                    line.strip().lstrip("-*0123456789. ")
                    for line in response_text.splitlines()
                    if line.strip() and not line.strip().startswith("{") and not line.strip().startswith("}")
                ]

            return Response({
                "suggestions": suggestions,
                "job_title": job.title,
                "company_name": company_name,
                "applicant_name": applicant_name,
                "company_email": job.company.email if job.company.email else None,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MatchingPeersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            resume = request.user.resumes
        except Resume.DoesNotExist:
            return Response(
                {"error": "You do not have a resume set up yet."},
                status=status.HTTP_404_NOT_FOUND,
            )

        ranked_peers = find_matching_peers_for_resume(resume)
        serializer = ResumeSerializer(ranked_peers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PeerSwipeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        peer_user_id = request.data.get("peer_user_id")
        is_interested = request.data.get("is_interested")

        if peer_user_id is None or is_interested is None:
            return Response(
                {"error": "peer_user_id and is_interested are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if int(peer_user_id) == request.user.id:
            return Response(
                {"error": "You cannot swipe on yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        peer_user = get_object_or_404(User, pk=peer_user_id)

        # Normalize user ordering so user1.id < user2.id
        if request.user.id < peer_user.id:
            u1, u2 = request.user, peer_user
        else:
            u1, u2 = peer_user, request.user

        match_record, _ = NetworkMatch.objects.get_or_create(user1=u1, user2=u2)

        if request.user == u1:
            match_record.user1_swiped_yes = is_interested
        else:
            match_record.user2_swiped_yes = is_interested

        match_record.save()

        is_mutual_match = (
            match_record.user1_swiped_yes is True and match_record.user2_swiped_yes is True
        )

        return Response(
            {
                "message": "Peer swipe recorded successfully.",
                "is_mutual_match": is_mutual_match,
            },
            status=status.HTTP_200_OK,
        )


class GetNetworkMatchesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        matches = NetworkMatch.objects.filter(
            (Q(user1=user) & Q(user1_swiped_yes=True)) |
            (Q(user2=user) & Q(user2_swiped_yes=True))
        ).select_related("user1", "user2").order_by("-created_at")

        serializer = NetworkMatchSerializer(matches, many=True, context={"request_user": user})
        return Response(serializer.data, status=status.HTTP_200_OK)


class DraftNetworkEmailSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        peer_user_id = request.data.get("peer_user_id")
        if not peer_user_id:
            return Response({"error": "peer_user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        peer_user = get_object_or_404(User, pk=peer_user_id)

        try:
            my_resume = request.user.resumes
        except Resume.DoesNotExist:
            return Response({"error": "You do not have a resume set up yet."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            peer_resume = peer_user.resumes
        except Resume.DoesNotExist:
            return Response({"error": "Peer user does not have a resume set up yet."}, status=status.HTTP_400_BAD_REQUEST)

        my_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        peer_name = f"{peer_user.first_name} {peer_user.last_name}".strip() or peer_user.username

        my_skills = list(my_resume.skills.values_list("skill", flat=True))
        peer_skills = list(peer_resume.skills.values_list("skill", flat=True))

        my_exp = [f"{e.title} at {e.company}" for e in my_resume.experiences.all()]
        peer_exp = [f"{e.title} at {e.company}" for e in peer_resume.experiences.all()]

        api_key = config("ANTHROPIC_API_KEY", default="")

        default_suggestions = [
            f"Mention your shared interest or overlapping skills in {', '.join(peer_skills[:2]) if peer_skills else 'technology'}.",
            f"Ask about their experience as a {peer_exp[0] if peer_exp else 'professional'}.",
            "Propose a quick 15-minute coffee chat or virtual call to share career insights.",
        ]
        default_draft = (
            f"Hi {peer_name},\n\n"
            f"I came across your profile on SeaJobs and saw your background as a {peer_exp[0] if peer_exp else 'peer'}. "
            f"I'm also passionate about {', '.join(peer_skills[:2]) if peer_skills else 'this field'} and would love to connect to exchange insights and network!\n\n"
            f"Would you be open to a quick chat sometime soon?\n\n"
            f"Best regards,\n{my_name}"
        )

        if not api_key:
            return Response({
                "suggestions": default_suggestions,
                "draft_email": default_draft,
                "peer_name": peer_name,
                "peer_email": peer_user.email if peer_user.email else None,
            }, status=status.HTTP_200_OK)

        try:
            client = anthropic.Anthropic(api_key=api_key)
            system_prompt = (
                "You are an expert career networking assistant. Help this professional write a warm, engaging, "
                "and concise networking outreach message to a peer candidate. "
                "Provide 3 bullet points with conversation advice and a complete draft email text. "
                "Output ONLY valid JSON in the format: {\"suggestions\": [\"...\", \"...\"], \"draft_email\": \"...\"}"
            )
            user_message = (
                f"Sender Name: {my_name}\n"
                f"Sender Summary: {my_resume.summary}\n"
                f"Sender Skills: {', '.join(my_skills)}\n"
                f"Sender Experience: {'; '.join(my_exp)}\n\n"
                f"Recipient Peer Name: {peer_name}\n"
                f"Recipient Summary: {peer_resume.summary}\n"
                f"Recipient Skills: {', '.join(peer_skills)}\n"
                f"Recipient Experience: {'; '.join(peer_exp)}\n"
            )

            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=600,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            response_text = msg.content[0].text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]

            parsed = json.loads(response_text.strip())
            suggestions = parsed.get("suggestions", default_suggestions)
            draft_email = parsed.get("draft_email", default_draft)
        except Exception:
            suggestions = default_suggestions
            draft_email = default_draft

        return Response({
            "suggestions": suggestions,
            "draft_email": draft_email,
            "peer_name": peer_name,
            "peer_email": peer_user.email if peer_user.email else None,
        }, status=status.HTTP_200_OK)
