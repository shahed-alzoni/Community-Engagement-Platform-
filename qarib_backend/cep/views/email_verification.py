from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from cep.serializers import EmailChangeConfirmSerializer, EmailChangeRequestSerializer
from cep.services import EmailVerificationService


class EmailChangeRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_otp_request"

    def post(self, request):
        serializer = EmailChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        EmailVerificationService.request_email_change(
            user=request.user, new_email=serializer.validated_data["new_email"],
        )
        return Response({"detail": "A verification code was sent to your new email."}, status=status.HTTP_202_ACCEPTED)


class EmailChangeConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_otp_confirm"

    def post(self, request):
        serializer = EmailChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = EmailVerificationService.confirm_email_change(
            user=request.user, code=serializer.validated_data["code"],
        )
        return Response({"email": email, "detail": "Your email address was updated."})
