from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from cep.services import PasswordResetService


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(write_only=True)
    token = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "The two password fields do not match."}
            )

        user = PasswordResetService.get_valid_user(
            uid=attrs["uid"],
            token=attrs["token"],
        )
        if user is None:
            raise serializers.ValidationError(
                {"detail": "This password reset link is invalid or has expired."}
            )

        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"new_password": list(error.messages)}) from error
        attrs["user"] = user
        return attrs

    def save(self):
        PasswordResetService.reset_password(
            user=self.validated_data["user"],
            new_password=self.validated_data["new_password"],
        )
