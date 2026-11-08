from rest_framework import serializers

from cep.services import AdminLoginService


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        return AdminLoginService.login(
            email=attrs["email"],
            password=attrs["password"],
            request=self.context.get("request"),
        )
