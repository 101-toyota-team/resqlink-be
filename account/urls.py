from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import CustomerRegisterView, ProviderAdminRegisterView, MeView

urlpatterns = [
    path("register/customer/", CustomerRegisterView.as_view(), name="register-customer"),
    path("register/provider-admin/", ProviderAdminRegisterView.as_view(), name="register-provider-admin"),
    path("login/", TokenObtainPairView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
]