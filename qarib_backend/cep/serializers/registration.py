from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from cep.models import User
from cep.services import CitizenRegistrationService


class CitizenRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="An account with this email address already exists.",
            )
        ]
    )
    phone_number = serializers.CharField(
        max_length=10,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="An account with this mobile number already exists.",
            )
        ],
    )
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "email",
            "phone_number",
            "password",
            "password_confirm",
            "role",
            "created_at",
        )
        read_only_fields = ("id", "role", "created_at")

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_phone_number(self, value: str) -> str:
        normalized_number = User.objects.normalize_phone_number(value)
        phone_field = User._meta.get_field("phone_number")
        for validator in phone_field.validators:
            validator(normalized_number)
        return normalized_number

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm"):
            raise serializers.ValidationError(
                {"password_confirm": "The two password fields do not match."}
            )
        return attrs

    def create(self, validated_data):
        return CitizenRegistrationService.register(**validated_data)
