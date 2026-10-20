import json
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from rest_framework import views, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .serializers import UserSerializer

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser
from .serializers import UserSerializer, AdminUserSerializer
from .models import CustomUser

from rest_framework import exceptions
from django.db.models import Q

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username_or_email = (attrs.get(self.username_field) or '').strip()
        password = attrs.get('password') or ''

        if not username_or_email:
            raise exceptions.AuthenticationFailed('Please enter your email or username.')
        if not password:
            raise exceptions.AuthenticationFailed('Please enter your password.')

        # Look up user by username or email (case-insensitive)
        user = CustomUser.objects.filter(
            Q(username__iexact=username_or_email) | Q(email__iexact=username_or_email)
        ).first()

        if not user or not user.check_password(password):
            raise exceptions.AuthenticationFailed(
                'Invalid username/email or password. Please verify your credentials and try again.'
            )

        if not user.is_active:
            raise exceptions.AuthenticationFailed(
                'This account has been deactivated. Please contact your system administrator.'
            )

        self.user = user
        refresh = self.get_token(user)

        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'is_admin': user.is_staff or user.is_superuser or user.role == 'Admin',
                'role': user.role,
                'access_list': user.access_list
            }
        }
        return data

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def check_auth_view(request):
    if request.user.is_authenticated and request.user.is_active:

        return Response({
            'is_authenticated': True,
            'user': {
                'id': request.user.id,
                'username': request.user.username,
                'first_name': request.user.first_name,
                'last_name': request.user.last_name,
                'is_admin': request.user.is_staff or request.user.is_superuser or request.user.role == 'Admin',
                'role': request.user.role,
                'access_list': request.user.access_list
            }
        })
    return Response({'is_authenticated': False}, status=200)

from django.db.models import Q
from rest_framework import viewsets, permissions
from .serializers import UserSerializer, AdminUserSerializer
from .models import CustomUser

class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and (request.user.is_staff or request.user.is_superuser or request.user.role == 'Admin')

class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        qs = CustomUser.objects.all().order_by('username')
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(role__icontains=search)
            )
        return qs

    def perform_update(self, serializer):
        instance = serializer.instance
        new_is_active = serializer.validated_data.get('is_active', instance.is_active)
        new_role = serializer.validated_data.get('role', instance.role)
        if instance.id == self.request.user.id:
            if new_is_active is False:
                raise exceptions.ValidationError({'detail': 'You cannot deactivate your own account.'})
            if new_role != 'Admin' and instance.role == 'Admin':
                raise exceptions.ValidationError({'detail': 'You cannot revoke your own administrator privileges.'})

        if instance.role == 'Admin' and (new_is_active is False or new_role != 'Admin'):
            active_admins = CustomUser.objects.filter(role='Admin', is_active=True).exclude(pk=instance.pk).count()
            if active_admins == 0:
                raise exceptions.ValidationError({'detail': 'Cannot deactivate or demote the sole active administrator.'})

        serializer.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        if instance.role == 'Admin':
            active_admins = CustomUser.objects.filter(role='Admin', is_active=True).exclude(pk=instance.pk).count()
            if active_admins == 0:
                return Response({'detail': 'Cannot delete the sole active administrator.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class ProfileAPIView(views.APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
    def post(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def put(self, request):
        return self.post(request)

    def patch(self, request):
        return self.post(request)

