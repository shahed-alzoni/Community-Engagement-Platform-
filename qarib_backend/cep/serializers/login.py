from rest_framework import serializers

from cep.services import LoginService
from cep.models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        return LoginService.login(
            email=attrs["email"],
            password=attrs["password"],
            request=self.context.get("request"),
            required_role=User.Role.CITIZEN,
        )
