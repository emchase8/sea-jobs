from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from pgvector.django import VectorField
from .embedding import generate_embedding


class Job(models.Model):
    class EmploymentType(models.TextChoices):
        INTERNSHIP = "internship", "Internship"
        PART_TIME = "part_time", "Part-time"
        FULL_TIME = "full_time", "Full-time"

    title = models.CharField(max_length=255)
    company = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="jobs",
        db_column="user_id"
    )
    location = models.CharField(max_length=255)
    pay = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=16, choices=EmploymentType.choices)
    description = models.TextField()

    description_embedding = VectorField(dimensions=1536, null=True, blank=True)

    def save(self, *args, **kwargs):
        text_to_embed = f"{self.title} {self.type} position. Details: {self.description}"

        if self.description:  
            self.description_embedding = generate_embedding(text_to_embed)
        else:
            self.description_embedding = None
            
        super().save(*args, **kwargs)


class Resume(models.Model):
    summary = models.TextField()
    owner = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="resumes",
        null=True
    )

    skills_embedding = VectorField(dimensions=1536, null=True, blank=True)
    experience_embedding = VectorField(dimensions=1536, null=True, blank=True)
    education_embedding = VectorField(dimensions=1536, null=True, blank=True)
    summary_embedding = VectorField(dimensions=1536, null=True, blank=True)

    def update_section_embedding(self, section_name: str):
        combined_text = ""
        field_to_update = f"{section_name}_embedding"

        if section_name == "skills":
            skills_list = [
                f"{e.skill}, " 
                for e in self.skills.all()
            ]
            if not skills_list:
                setattr(self, field_to_update, None)
                self.save(update_fields=[field_to_update])
                return
            combined_text = "Skills:\n" + "\n".join(skills_list)
        if section_name == "experience":
            exp_list = [
                f"{e.title} at {e.company}. Details: {e.description}" 
                for e in self.experiences.all()
            ]
            if not exp_list:
                setattr(self, field_to_update, None)
                self.save(update_fields=[field_to_update])
                return
            combined_text = "Experience:\n" + "\n".join(exp_list)
        if section_name == "education":
            edu_list = [
                f"{e.degree} in {e.major} at {e.title}. Details: {e.description}" 
                for e in self.education.all()
            ]
            if not edu_list:
                setattr(self, field_to_update, None)
                self.save(update_fields=[field_to_update])
                return
            combined_text = "Education History:\n" + "\n".join(edu_list)

        if combined_text:
            vector = generate_embedding(combined_text)
            setattr(self, field_to_update, vector)
            self.save(update_fields=[field_to_update])

    def save(self, *args, **kwargs):
        if self.summary:
            combined_text = f"Professional Summary: {self.summary}"
            self.summary_embedding = generate_embedding(combined_text)
        else:
            self.summary_embedding = None
            
        super().save(*args, **kwargs)


class UserType(models.TextChoices):
    RECRUITER = "recruiter", "Recruiter"
    APPLICANT = "applicant", "Applicant"

class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    user_type = models.CharField(max_length=16, choices=UserType.choices, default=UserType.RECRUITER)
    description = models.TextField(
        null=True
    )


class Education(models.Model):
    resume = models.ForeignKey(
        Resume,
        on_delete=models.CASCADE,
        related_name="education",
    )
    title = models.CharField(max_length=255)
    degree = models.CharField(max_length=100)
    major = models.CharField(max_length=255)
    gpa = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(4)],
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)


class Experience(models.Model):
    class ExperienceType(models.TextChoices):
        JOB = "job", "Job"
        PROJECT = "project", "Project"

    resume = models.ForeignKey(
        Resume,
        on_delete=models.CASCADE,
        related_name="experiences",
    )
    title = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True)
    start_date = models.DateField()
    current_job = models.BooleanField(default=False)
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=7, choices=ExperienceType.choices)


class Skill(models.Model):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="skills",
        null=True,
        blank=True,
    )
    resume = models.ForeignKey(
        Resume,
        on_delete=models.CASCADE,
        related_name="skills",
        null=True,
        blank=True,
    )
    skill = models.CharField(max_length=255)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(job__isnull=False, resume__isnull=True)
                    | models.Q(job__isnull=True, resume__isnull=False)
                ),
                name="skill_has_exactly_one_owner",
            ),
        ]

class Match(models.Model):
    job = models.ForeignKey(
        Job, 
        on_delete=models.CASCADE, 
        related_name='matches'
    )
    resume = models.ForeignKey(
        Resume, 
        on_delete=models.CASCADE, 
        related_name='matches'
    )
    
    # null = hasn't swiped yet, False = swiped left (Pass), True = swiped right (Like)
    applicant_swiped_yes = models.BooleanField(null=True, blank=True)
    employer_swiped_yes = models.BooleanField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Ensures a specific resume and specific job can only have one relationship row
        constraints = [
            models.UniqueConstraint(
                fields=['job', 'resume'], 
                name='unique_mutual_match'
            )
        ]


class NetworkMatch(models.Model):
    user1 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="network_matches_as_user1",
    )
    user2 = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="network_matches_as_user2",
    )

    # null = hasn't swiped yet, False = swiped left (Pass), True = swiped right (Connect)
    user1_swiped_yes = models.BooleanField(null=True, blank=True)
    user2_swiped_yes = models.BooleanField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user1", "user2"],
                name="unique_peer_network_match"
            )
        ]