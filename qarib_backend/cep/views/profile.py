from rest_framework import generics, status
from rest_framework.response import Response

from cep.permissions import IsPortalUser
from cep.serializers import ProfileSerializer, ProfileUpdateSerializer


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
        serializer.save()
        return Response(ProfileSerializer(user).data, status=status.HTTP_200_OK)
