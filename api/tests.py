from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Job, Resume, Skill, UserProfile, UserType
from .views import _anthropic_models, normalize_parsed_resume

ZERO_VECTOR = [0.0] * 1536


class APITestBase(APITestCase):
    def setUp(self):
        embedding_patch = patch("api.models.generate_embedding", return_value=ZERO_VECTOR)
        embedding_patch.start()
        self.addCleanup(embedding_patch.stop)
        self.applicant = User.objects.create_user("applicant", password="StrongPass123!")
        UserProfile.objects.create(user=self.applicant, user_type=UserType.APPLICANT, description="Developer")
        self.recruiter = User.objects.create_user("recruiter", password="StrongPass123!")
        UserProfile.objects.create(user=self.recruiter, user_type=UserType.RECRUITER, description="Hiring team")
        self.other_recruiter = User.objects.create_user("other", password="StrongPass123!")
        UserProfile.objects.create(user=self.other_recruiter, user_type=UserType.RECRUITER)

    def authenticate(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def create_job(self, owner=None):
        job = Job.objects.create(company=owner or self.recruiter, title="Backend Engineer", location="Remote", pay="95000.00", type=Job.EmploymentType.FULL_TIME, description="Build APIs")
        Skill.objects.create(job=job, skill="Python")
        return job

    def assert_no_embeddings(self, value):
        if isinstance(value, dict):
            for key, child in value.items():
                self.assertNotIn("embedding", key.lower())
                self.assert_no_embeddings(child)
        elif isinstance(value, list):
            for child in value:
                self.assert_no_embeddings(child)


class AuthenticationTests(APITestBase):
    def test_login_returns_token_and_complete_profile(self):
        response = self.client.post("/api/auth/login/", {"username": "applicant", "password": "StrongPass123!"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["profile"]["user"]["username"], "applicant")
        self.assertEqual(response.data["profile"]["user_type"], UserType.APPLICANT)

    def test_registration_creates_profile_and_returns_token(self):
        response = self.client.post("/api/auth/register/applicant/", {"username": "new-user", "email": "new@example.com", "password": "UniquePass123!", "description": "New applicant"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["profile"]["user_type"], UserType.APPLICANT)


class UserEndpointTests(APITestBase):
    def test_user_detail_is_available_and_current_user_is_applicant_only(self):
        self.authenticate(self.recruiter)
        self.assertEqual(self.client.get(f"/api/user/{self.applicant.id}/").status_code, 200)
        self.assertEqual(self.client.get("/api/user/").status_code, 401)

    def test_delete_current_user_cascades_profile(self):
        user_id = self.applicant.id
        self.authenticate(self.applicant)
        self.assertEqual(self.client.delete("/api/user/").status_code, 204)
        self.assertFalse(User.objects.filter(pk=user_id).exists())
        self.assertFalse(UserProfile.objects.filter(user_id=user_id).exists())

    def test_user_resume_returns_404_for_recruiter(self):
        self.authenticate(self.applicant)
        self.assertEqual(self.client.get(f"/api/user/{self.recruiter.id}/resume/").status_code, 404)


class JobEndpointTests(APITestBase):
    def test_recruiter_can_create_list_update_and_delete_job_with_skills(self):
        self.authenticate(self.recruiter)
        payload = {"title": "API Engineer", "location": "Denver", "pay": "100000.00", "type": "full_time", "description": "Develop services", "skills": ["Python", "Django"]}
        created = self.client.post("/api/job/", payload, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["skills"], ["Python", "Django"])
        self.assert_no_embeddings(created.data)
        self.assertEqual(len(self.client.get("/api/job/").data), 1)
        updated = self.client.post(f"/api/job/{created.data['id']}/", {"skills": ["REST"]}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["skills"], ["REST"])
        self.assertEqual(self.client.delete(f"/api/job/{created.data['id']}/").status_code, 204)

    def test_non_owner_cannot_update_or_delete_job(self):
        job = self.create_job()
        self.authenticate(self.other_recruiter)
        self.assertEqual(self.client.post(f"/api/job/{job.id}/", {"title": "Stolen"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/job/{job.id}/").status_code, 404)

    def test_applicant_job_list_is_unauthorized(self):
        self.authenticate(self.applicant)
        self.assertEqual(self.client.get("/api/job/").status_code, 401)


class ResumeEndpointTests(APITestBase):
    def resume_payload(self):
        return {
            "summary": "Backend developer",
            "experience": [{"title": "Engineer", "company": "Acme", "start_date": "2024-01-01", "end_date": None, "current_job": True, "description": "Built APIs", "type": "job"}],
            "education": [{"title": "State University", "degree": "BS", "major": "Computer Science", "gpa": "3.75", "start_date": "2020-09-01", "end_date": "2024-05-01", "description": ""}],
            "skills": ["Python", "Django"],
        }

    def test_applicant_can_create_retrieve_and_partially_update_resume(self):
        self.authenticate(self.applicant)
        created = self.client.post("/api/resume/", self.resume_payload(), format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["skills"], ["Python", "Django"])
        self.assert_no_embeddings(created.data)
        retrieved = self.client.get(f"/api/resume/{created.data['id']}/")
        self.assertEqual(retrieved.status_code, 200)
        self.assertEqual(len(retrieved.data["experience"]), 1)
        updated = self.client.post(f"/api/resume/{created.data['id']}/", {"summary": "Updated"}, format="json")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["summary"], "Updated")

    def test_resume_update_is_owner_only(self):
        resume = Resume.objects.create(owner=self.applicant, summary="Mine")
        second = User.objects.create_user("second", password="StrongPass123!")
        UserProfile.objects.create(user=second, user_type=UserType.APPLICANT)
        self.authenticate(second)
        self.assertEqual(self.client.post(f"/api/resume/{resume.id}/", {"summary": "Stolen"}, format="json").status_code, 404)

    def test_pdf_upload_creates_resume_when_none_exists(self):
        self.authenticate(self.applicant)
        uploaded_file = SimpleUploadedFile("resume.pdf", b"%PDF-1.4 resume", content_type="application/pdf")

        with patch("api.views.parse_resume_pdf_with_anthropic", return_value=self.resume_payload()):
            response = self.client.post("/api/resume/upload/", {"file": uploaded_file}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["summary"], "Backend developer")
        self.assertEqual(response.data["skills"], ["Python", "Django"])
        self.assertEqual(Resume.objects.get(owner=self.applicant).summary, "Backend developer")

    def test_pdf_upload_updates_existing_resume(self):
        resume = Resume.objects.create(owner=self.applicant, summary="Old summary")
        self.authenticate(self.applicant)
        payload = self.resume_payload()
        payload["summary"] = "Parsed from PDF"
        payload["skills"] = ["FastAPI"]
        uploaded_file = SimpleUploadedFile("resume.pdf", b"%PDF-1.4 resume", content_type="application/pdf")

        with patch("api.views.parse_resume_pdf_with_anthropic", return_value=payload):
            response = self.client.post("/api/resume/upload/", {"file": uploaded_file}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], resume.id)
        self.assertEqual(response.data["summary"], "Parsed from PDF")
        self.assertEqual(response.data["skills"], ["FastAPI"])
        resume.refresh_from_db()
        self.assertEqual(resume.summary, "Parsed from PDF")

    def test_pdf_upload_is_applicant_only_and_requires_pdf(self):
        self.authenticate(self.recruiter)
        uploaded_file = SimpleUploadedFile("resume.pdf", b"%PDF-1.4 resume", content_type="application/pdf")
        self.assertEqual(self.client.post("/api/resume/upload/", {"file": uploaded_file}, format="multipart").status_code, 401)

        self.authenticate(self.applicant)
        text_file = SimpleUploadedFile("resume.txt", b"resume", content_type="text/plain")
        response = self.client.post("/api/resume/upload/", {"file": text_file}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pdf_upload_accepts_incomplete_parsed_resume_data(self):
        self.authenticate(self.applicant)
        parsed_payload = {
            "summary": "Technology leader",
            "experience": [{"title": "Co-founder", "company": "Microsoft", "start_date": "1975"}],
            "education": [{"title": "Harvard University"}],
            "skills": "Software, Leadership",
        }
        uploaded_file = SimpleUploadedFile("resume.pdf", b"%PDF-1.4 resume", content_type="application/octet-stream")

        with patch("api.views.parse_resume_pdf_with_anthropic", return_value=normalize_parsed_resume(parsed_payload)):
            response = self.client.post("/api/resume/upload/", {"file": uploaded_file}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["experience"][0]["start_date"], "1975-01-01")
        self.assertEqual(response.data["education"][0]["degree"], "Not specified")
        self.assertEqual(response.data["skills"], ["Software", "Leadership"])

    def test_anthropic_models_default_to_current_aliases(self):
        with patch("api.views.config", return_value=""):
            self.assertEqual(
                _anthropic_models(),
                ["claude-sonnet-5-5", "claude-sonnet-5", "claude-haiku-4-5"],
            )

    def test_anthropic_models_can_be_configured(self):
        with patch("api.views.config", return_value="claude-haiku-4-5, claude-sonnet-5"):
            self.assertEqual(_anthropic_models(), ["claude-haiku-4-5", "claude-sonnet-5"])


class MatchingEndpointTests(APITestBase):
    def test_matching_requires_resume_and_returns_match_percentage(self):
        self.authenticate(self.applicant)
        # Without resume, returns 404
        self.assertEqual(self.client.get("/api/matching/jobs/").status_code, 404)

        job = self.create_job()
        job.composite_score = 0.15  # 85% match (1 - 0.15)
        resume = Resume.objects.create(owner=self.applicant, summary="Engineer")

        with patch("api.views.find_matching_jobs_for_resume", return_value=[job]):
            response = self.client.get("/api/matching/jobs/")
        
        self.assertEqual(response.status_code, 200)
        self.assert_no_embeddings(response.data)
        self.assertEqual(response.data[0]["match_percentage"], 85)

    def test_job_serializer_match_percentage(self):
        job = self.create_job()
        job.composite_score = 0.22
        from .serializers import JobSerializer
        serializer = JobSerializer(job)
        self.assertEqual(serializer.data["match_percentage"], 78)


class NetworkEndpointTests(APITestBase):
    def setUp(self):
        super().setUp()
        self.peer = User.objects.create_user("peer_applicant", password="StrongPass123!")
        UserProfile.objects.create(user=self.peer, user_type=UserType.APPLICANT, description="Frontend Dev")
        self.applicant_resume = Resume.objects.create(owner=self.applicant, summary="Backend Dev")
        self.peer_resume = Resume.objects.create(owner=self.peer, summary="Frontend Dev")

    def test_matching_peers_endpoint(self):
        self.authenticate(self.applicant)
        response = self.client.get("/api/matching/peers/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) >= 1)

    def test_peer_swipe_and_mutual_match(self):
        # Applicant swipes yes on peer
        self.authenticate(self.applicant)
        res1 = self.client.post("/api/swipe/peer/", {"peer_user_id": self.peer.id, "is_interested": True}, format="json")
        self.assertEqual(res1.status_code, 200)
        self.assertFalse(res1.data["is_mutual_match"])

        # Peer swipes yes on applicant
        self.authenticate(self.peer)
        res2 = self.client.post("/api/swipe/peer/", {"peer_user_id": self.applicant.id, "is_interested": True}, format="json")
        self.assertEqual(res2.status_code, 200)
        self.assertTrue(res2.data["is_mutual_match"])

        # Check mutual matches list
        res3 = self.client.get("/api/matches/network/")
        self.assertEqual(res3.status_code, 200)
        self.assertEqual(len(res3.data), 1)
        self.assertEqual(res3.data[0]["peer_user"]["username"], "applicant")

    def test_draft_network_email_suggestions(self):
        self.authenticate(self.applicant)
        res = self.client.post("/api/matches/draft-network-suggestions/", {"peer_user_id": self.peer.id}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertIn("suggestions", res.data)
        self.assertIn("draft_email", res.data)

