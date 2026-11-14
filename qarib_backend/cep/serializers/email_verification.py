from rest_framework import serializers


class EmailChangeRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()

    def validate_new_email(self, value):
        return value.strip().lower()


class EmailChangeConfirmSerializer(serializers.Serializer):
    code = serializers.RegexField(regex=r"^\d{6}$")
