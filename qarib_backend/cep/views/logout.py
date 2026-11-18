from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from cep.serializers import LogoutSerializer
from cep.services import LogoutService


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        LogoutService.logout(refresh=serializer.validated_data["refresh"])
        return Response(status=status.HTTP_204_NO_CONTENT)
