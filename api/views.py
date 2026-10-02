import json
import anthropic
from decouple import config
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .matching import find_matching_jobs_for_resume, find_matching_resumes_for_job
from .models import Job, Match, Resume, UserProfile, UserType
from .serializers import JobSerializer, MatchSerializer, RegisterSerializer, ResumeSerializer, UserProfileSerializer


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

            models_to_try = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-sonnet-5"]
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
