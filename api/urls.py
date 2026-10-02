from django.urls import path

from .views import (
    JobView,
    LoginView,
    MatchingJobs,
    MatchingResumes,
    RegisterView,
    ResumeView,
    UserResumeView,
    UserView,
    GetMatchesForJobView,
    GetMatchesForResumeView,
    SwipeView,
    DraftMessageSuggestionsView,
)

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/register/<str:user_type>/", RegisterView.as_view(), name="register"),
    path("user/", UserView.as_view(), name="current-user"),
    path("user/<int:user_id>/", UserView.as_view(), name="user-detail"),
    path("user/<int:user_id>/resume/", UserResumeView.as_view(), name="user-resume"),
    path("job/", JobView.as_view(), name="jobs"),
    path("job/<int:job_id>/", JobView.as_view(), name="job-detail"),
    path("resume/", ResumeView.as_view(), name="resumes"),
    path("resume/<int:resume_id>/", ResumeView.as_view(), name="resume-detail"),
    path("matching/resumes/", MatchingResumes.as_view(), name="matching-resumes"),
    path("matching/jobs/", MatchingJobs.as_view(), name="matching-jobs"),
    path("matches/applicant/", GetMatchesForResumeView.as_view(), name="applicant-matches"),
    path("matches/recruiter/<int:job_id>/", GetMatchesForJobView.as_view(), name="recruiter-matches"),
    path("matches/draft-suggestions/", DraftMessageSuggestionsView.as_view(), name="draft-message-suggestions"),
    path("swipe/", SwipeView.as_view(), name="swipe"),
]
