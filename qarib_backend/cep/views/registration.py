from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from cep.serializers import CitizenRegistrationConfirmSerializer, CitizenRegistrationResendSerializer, CitizenRegistrationSerializer
from cep.services import EmailVerificationService, LoginService


class CitizenRegistrationView(generics.CreateAPIView):
    serializer_class = CitizenRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_otp_request"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        EmailVerificationService.start_registration(**serializer.validated_data)
        return Response(
            {"email": serializer.validated_data["email"], "detail": "A verification code was sent to your email."},
            status=status.HTTP_202_ACCEPTED,
        )


class CitizenRegistrationResendView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_otp_request"

    def post(self, request):
        serializer = CitizenRegistrationResendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        EmailVerificationService.resend_registration(email=serializer.validated_data["email"])
        return Response({"detail": "A new verification code was sent."})


class CitizenRegistrationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_otp_confirm"

    def post(self, request):
        serializer = CitizenRegistrationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = EmailVerificationService.confirm_registration(**serializer.validated_data)
        return Response(LoginService.issue_tokens(user), status=status.HTTP_201_CREATED)
