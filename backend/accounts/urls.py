from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MyTokenObtainPairView, check_auth_view, ProfileAPIView, UserViewSet
from rest_framework_simplejwt.views import TokenRefreshView

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='users')

urlpatterns = [
    path('token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('check-auth/', check_auth_view, name='api-check-auth'),
    path('profile/', ProfileAPIView.as_view(), name='api-profile'),
    path('', include(router.urls)),
]
