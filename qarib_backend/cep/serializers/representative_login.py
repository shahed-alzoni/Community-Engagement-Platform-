from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from cep.services import RepresentativeLoginService


class RepresentativeLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        return RepresentativeLoginService.login(
            email=attrs["email"],
            password=attrs["password"],
            request=self.context.get("request"),
        )


class RepresentativeInitialPasswordChangeSerializer(serializers.Serializer):
    token = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "The two password fields do not match."}
            )
        try:
            validate_password(attrs["new_password"])
        except DjangoValidationError as error:
            raise serializers.ValidationError({"new_password": list(error.messages)}) from error
        return attrs

    def save(self):
        return RepresentativeLoginService.change_initial_password(
            token=self.validated_data["token"],
            new_password=self.validated_data["new_password"],
        )
