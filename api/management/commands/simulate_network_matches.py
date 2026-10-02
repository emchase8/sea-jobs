from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from api.models import NetworkMatch, Resume, UserType


class Command(BaseCommand):
    help = "Simulate mutual network connections between applicants"

    def add_arguments(self, parser):
        parser.add_argument("applicant_username", help="Username of the applicant to simulate connections for")
        parser.add_argument("--count", type=int, default=3, help="Number of mutual peer connections to create")

    def handle(self, *args, **options):
        applicant_username = options["applicant_username"]
        count = options["count"]

        try:
            applicant = User.objects.select_related("profile").get(username=applicant_username)
        except User.DoesNotExist as error:
            raise CommandError(f"User '{applicant_username}' was not found.") from error

        if applicant.profile.user_type != UserType.APPLICANT:
            raise CommandError(f"User '{applicant_username}' is not an applicant.")

        # Find other applicants with resumes
        other_applicants = list(
            User.objects.filter(
                profile__user_type=UserType.APPLICANT,
                resumes__isnull=False
            ).exclude(id=applicant.id)[:count]
        )

        if not other_applicants:
            # If no other applicants with resumes exist, grab any other applicants
            other_applicants = list(
                User.objects.filter(
                    profile__user_type=UserType.APPLICANT
                ).exclude(id=applicant.id)[:count]
            )

        if not other_applicants:
            raise CommandError("No other applicants found in database to connect with.")

        created_count = 0
        with transaction.atomic():
            for peer in other_applicants:
                u1, u2 = (applicant, peer) if applicant.id < peer.id else (peer, applicant)
                match, created = NetworkMatch.objects.get_or_create(user1=u1, user2=u2)
                match.user1_swiped_yes = True
                match.user2_swiped_yes = True
                match.save()
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully simulated {created_count} mutual networking match(es) for '{applicant_username}'!"
            )
        )
