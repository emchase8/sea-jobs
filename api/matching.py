from pgvector.django import CosineDistance
from api.models import Resume, Job, Match, NetworkMatch, UserType
from django.db.models import F, ExpressionWrapper, FloatField, Q
from api.embedding import generate_embedding

EXP_WEIGHT = 0.4
SKILL_WEIGHT = 0.4
EDU_WEIGHT = 0.2


def find_matching_resumes_for_job(job:Job):
    if not job.description_embedding:
        return []

    seen_resume_ids = Match.objects.filter(
        job=job, 
        employer_swiped_yes__isnull=False
    ).values_list('resume_id', flat=True)

    ranked_resumes = Resume.objects.exclude(id__in=seen_resume_ids).annotate(
        skill_dist=CosineDistance('skills_embedding', job.description_embedding),
        exp_dist=CosineDistance('experience_embedding', job.description_embedding),
        edu_dist=CosineDistance('education_embedding', job.description_embedding),
    ).annotate(
        composite_score=ExpressionWrapper(
            (F('skill_dist') * SKILL_WEIGHT) + (F('exp_dist') * EXP_WEIGHT) + (F('edu_dist') * EDU_WEIGHT),
            output_field=FloatField()
        )
    ).order_by('composite_score')[:10]  # lowest composite score = best match, batches of 10

    return ranked_resumes


def find_matching_jobs_for_resume(resume: Resume):
    if not resume.skills_embedding or not resume.experience_embedding or not resume.education_embedding:
        return []

    seen_job_ids = Match.objects.filter(
        resume=resume, 
        applicant_swiped_yes__isnull=False
    ).values_list('job_id', flat=True)

    ranked_jobs = Job.objects.exclude(description_embedding__isnull=True).exclude(id__in=seen_job_ids).annotate(
        skill_dist=CosineDistance('description_embedding', resume.skills_embedding),
        exp_dist=CosineDistance('description_embedding', resume.experience_embedding),
        edu_dist=CosineDistance('description_embedding', resume.education_embedding),
    ).annotate(
        composite_score=ExpressionWrapper(
            (F('skill_dist') * SKILL_WEIGHT) + (F('exp_dist') * EXP_WEIGHT) + (F('edu_dist') * EDU_WEIGHT),
            output_field=FloatField()
        )
    ).order_by('composite_score')[:10]  # lowest composite score = best match, batches of 10

    return ranked_jobs


def find_matching_peers_for_resume(resume: Resume):
    user = resume.owner
    if not user:
        return []

    swiped_as_user1 = NetworkMatch.objects.filter(
        user1=user, user1_swiped_yes__isnull=False
    ).values_list('user2_id', flat=True)

    swiped_as_user2 = NetworkMatch.objects.filter(
        user2=user, user2_swiped_yes__isnull=False
    ).values_list('user1_id', flat=True)

    seen_user_ids = set(swiped_as_user1).union(set(swiped_as_user2))
    seen_user_ids.add(user.id)

    candidates = Resume.objects.select_related('owner', 'owner__profile').exclude(
        owner_id__in=seen_user_ids
    ).filter(
        owner__profile__user_type=UserType.APPLICANT
    )

    if resume.skills_embedding and resume.experience_embedding:
        ranked = candidates.annotate(
            skill_dist=CosineDistance('skills_embedding', resume.skills_embedding),
            exp_dist=CosineDistance('experience_embedding', resume.experience_embedding),
        ).annotate(
            composite_score=ExpressionWrapper(
                (F('skill_dist') * 0.5) + (F('exp_dist') * 0.5),
                output_field=FloatField()
            )
        ).order_by('composite_score')[:15]
        return ranked

    return candidates.order_by('-id')[:15]