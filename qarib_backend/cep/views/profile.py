from rest_framework import generics, status
from rest_framework.response import Response

from cep.permissions import IsPortalUser
from cep.serializers import ProfileSerializer, ProfileUpdateSerializer
from cep.services import EmailVerificationService


class ProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsPortalUser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return ProfileUpdateSerializer if self.request.method in {"PUT", "PATCH"} else ProfileSerializer

    def update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = ProfileUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_email = serializer.validated_data.get("email")
        verification_required = new_email is not None and new_email != user.email
        if verification_required:
            EmailVerificationService.request_email_change(user=user, new_email=new_email)
            serializer.validated_data.pop("email")
        serializer.save()
        data = ProfileSerializer(user).data
        if verification_required:
            data["verification_required"] = True
            data["pending_email"] = new_email
        return Response(data, status=status.HTTP_202_ACCEPTED if verification_required else status.HTTP_200_OK)
