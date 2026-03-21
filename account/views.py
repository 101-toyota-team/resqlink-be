from rest_framework import generics, permissions
from .models import User
from .serializers import (
    UserSerializer,
    CustomerRegisterSerializer,
    ProviderAdminRegisterSerializer,
)

class CustomerRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = CustomerRegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProviderAdminRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = ProviderAdminRegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user