from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.matching import find_matching_jobs_for_resume
from api.models import Match, Resume, UserType


class Command(BaseCommand):
    help = "Simulate applicant yes-swipes and mutual matches for ranked jobs"

    def add_arguments(self, parser):
        parser.add_argument("applicant_username", help="Username of the applicant to simulate")
        parser.add_argument("--job-count", type=int, default=5)
        parser.add_argument("--mutual-count", type=int, default=2)

    def handle(self, *args, **options):
        applicant_username = options["applicant_username"]
        job_count = options["job_count"]
        mutual_count = options["mutual_count"]

        if job_count < 1 or job_count > 10:
            raise CommandError("--job-count must be between 1 and 10.")
        if mutual_count < 0 or mutual_count > job_count:
            raise CommandError("--mutual-count must be between 0 and --job-count.")

        try:
            applicant = User.objects.select_related("profile").get(
                username=applicant_username
            )
        except User.DoesNotExist as error:
            raise CommandError(f"Applicant '{applicant_username}' was not found.") from error
        except User.profile.RelatedObjectDoesNotExist as error:
            raise CommandError(
                f"User '{applicant_username}' does not have a profile."
            ) from error

        if applicant.profile.user_type != UserType.APPLICANT:
            raise CommandError(f"User '{applicant_username}' is not an applicant.")

        try:
            resume = Resume.objects.get(owner=applicant)
        except Resume.DoesNotExist as error:
            raise CommandError(
                f"Applicant '{applicant_username}' does not have a resume."
            ) from error

        jobs = list(find_matching_jobs_for_resume(resume)[:job_count])
        if len(jobs) < job_count:
            raise CommandError(
                f"Only {len(jobs)} ranked jobs are available for '{applicant_username}'; "
                f"{job_count} requested. Check that jobs and resume embeddings are available."
            )

        with transaction.atomic():
            for index, job in enumerate(jobs):
                Match.objects.update_or_create(
                    job=job,
                    resume=resume,
                    defaults={
                        "applicant_swiped_yes": True,
                        "employer_swiped_yes": index < mutual_count if index < mutual_count else None,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Simulated {job_count} applicant yes-swipes for {applicant_username}: "
                f"{mutual_count} mutual matches and {job_count - mutual_count} awaiting company response."
            )
        )