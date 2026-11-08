from rest_framework import generics, permissions

from cep.serializers import CitizenRegistrationSerializer


class CitizenRegistrationView(generics.CreateAPIView):
    serializer_class = CitizenRegistrationSerializer
    permission_classes = [permissions.AllowAny]
