from rest_framework import serializers

from cep.models import User
from cep.services import ProfileService


class ProfileSerializer(serializers.ModelSerializer):
    organization_id = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "full_name", "email", "phone_number", "role",
            "organization_id", "organization_name", "created_at",
        )
        read_only_fields = fields

    def _assignment(self, user):
        return getattr(user, "active_organization_assignment", None)

    def get_organization_id(self, user):
        assignment = self._assignment(user)
        return assignment.organization_id if assignment else None

    def get_organization_name(self, user):
        assignment = self._assignment(user)
        return assignment.organization.name if assignment else None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("full_name", "email", "phone_number")

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.exclude(pk=self.instance.pk).filter(email=normalized).exists():
            raise serializers.ValidationError("This email address is already in use.")
        return normalized

    def validate_phone_number(self, value):
        normalized = User.objects.normalize_phone_number(value)
        phone_field = User._meta.get_field("phone_number")
        for validator in phone_field.validators:
            validator(normalized)
        if User.objects.exclude(pk=self.instance.pk).filter(phone_number=normalized).exists():
            raise serializers.ValidationError("This mobile number is already in use.")
        return normalized

    def update(self, instance, validated_data):
        return ProfileService.update(user=instance, **validated_data)
