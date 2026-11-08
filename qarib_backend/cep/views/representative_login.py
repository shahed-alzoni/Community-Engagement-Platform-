from rest_framework import generics, permissions, status
from rest_framework.response import Response

from cep.serializers import (
    RepresentativeInitialPasswordChangeSerializer,
    RepresentativeLoginSerializer,
)


class RepresentativeLoginView(generics.GenericAPIView):
    serializer_class = RepresentativeLoginSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class RepresentativeInitialPasswordChangeView(generics.GenericAPIView):
    serializer_class = RepresentativeInitialPasswordChangeSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.save(), status=status.HTTP_200_OK)
