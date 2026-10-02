from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from .models import Education, Experience, Job, Resume, Skill, UserProfile, UserType, Match

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "company_name"]

    def get_company_name(self, obj):
        return obj.first_name if obj.first_name else obj.username


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = ["id", "user", "user_type", "description"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "password", "description"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        user_type = self.context["user_type"]
        if user_type not in UserType.values:
            raise serializers.ValidationError({"user_type": "User must be a recruiter or an applicant."})
        attrs["profile_user_type"] = user_type
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        user_type = validated_data.pop("profile_user_type")
        description = validated_data.pop("description", None)
        user = User.objects.create_user(**validated_data)
        UserProfile.objects.create(user=user, user_type=user_type, description=description)
        return user


class EducationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Education
        fields = ["id", "title", "degree", "major", "gpa", "start_date", "end_date", "description"]
        read_only_fields = ["id"]


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        fields = ["id", "title", "company", "start_date", "end_date", "current_job", "description", "type"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        current_job = attrs.get("current_job", getattr(self.instance, "current_job", False))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if current_job and end_date is not None:
            raise serializers.ValidationError({"end_date": "A current job cannot have an end date."})
        return attrs


class SkillListField(serializers.ListField):
    """Represent related Skill rows as the string list accepted by writes."""

    def to_representation(self, data):
        if hasattr(data, "values_list"):
            return list(data.values_list("skill", flat=True))
        return super().to_representation(data)


class ResumeSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    experience = ExperienceSerializer(many=True, source="experiences")
    education = EducationSerializer(many=True)
    skills = SkillListField(child=serializers.CharField(max_length=255))

    class Meta:
        model = Resume
        fields = ["id", "owner", "summary", "experience", "education", "skills"]
        read_only_fields = ["id", "owner"]

    @transaction.atomic
    def create(self, validated_data):
        experiences = validated_data.pop("experiences")
        education = validated_data.pop("education")
        skills = validated_data.pop("skills")
        resume = Resume.objects.create(**validated_data)
        self._replace_nested(resume, experiences, education, skills)
        return resume

    @transaction.atomic
    def update(self, instance, validated_data):
        experiences = validated_data.pop("experiences", None)
        education = validated_data.pop("education", None)
        skills = validated_data.pop("skills", None)
        instance = super().update(instance, validated_data)
        self._replace_nested(instance, experiences, education, skills)
        return instance

    @staticmethod
    def _replace_nested(resume, experiences=None, education=None, skills=None):
        if experiences is not None:
            resume.experiences.all().delete()
            Experience.objects.bulk_create([Experience(resume=resume, **item) for item in experiences])
            resume.update_section_embedding("experience")
        if education is not None:
            resume.education.all().delete()
            Education.objects.bulk_create([Education(resume=resume, **item) for item in education])
            resume.update_section_embedding("education")
        if skills is not None:
            resume.skills.all().delete()
            Skill.objects.bulk_create([Skill(resume=resume, skill=skill) for skill in skills])
            resume.update_section_embedding("skills")


class JobSerializer(serializers.ModelSerializer):
    company = UserSerializer(read_only=True)
    skills = SkillListField(child=serializers.CharField(max_length=255))

    class Meta:
        model = Job
        fields = ["id", "title", "company", "location", "pay", "type", "description", "skills"]
        read_only_fields = ["id", "company"]

    @transaction.atomic
    def create(self, validated_data):
        skills = validated_data.pop("skills")
        job = Job.objects.create(**validated_data)
        Skill.objects.bulk_create([Skill(job=job, skill=skill) for skill in skills])
        return job

    @transaction.atomic
    def update(self, instance, validated_data):
        skills = validated_data.pop("skills", None)
        instance = super().update(instance, validated_data)
        if skills is not None:
            instance.skills.all().delete()
            Skill.objects.bulk_create([Skill(job=instance, skill=skill) for skill in skills])
        return instance

class MatchSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    resume = ResumeSerializer(read_only=True)
    is_mutual_match = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            "id",
            "job",
            "resume",
            "applicant_swiped_yes",
            "employer_swiped_yes",
            "is_mutual_match",
            "created_at",
        ]
        read_only_fields = ["id"]

    def get_is_mutual_match(self, obj):
        return bool(obj.applicant_swiped_yes is True and obj.employer_swiped_yes is True)
