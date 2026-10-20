import logging
from rest_framework_simplejwt.authentication import JWTAuthentication
from .recycle_bin import set_current_user, set_bypass_recycle_bin

logger = logging.getLogger(__name__)

class CurrentUserMiddleware:
    """
    Middleware that captures the current authenticated user (including JWT Bearer auth)
    and stores it in thread-local storage for use during signals and deletions.
    Also detects permanent deletion requests via query param (?permanent=true) or header.
    """
    def __init__(self, get_response):
        self.get_response = get_response
        self.jwt_auth = JWTAuthentication()

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                try:
                    raw_token = auth_header.split(' ')[1]
                    validated_token = self.jwt_auth.get_validated_token(raw_token)
                    user = self.jwt_auth.get_user(validated_token)
                    request.user = user
                except Exception:
                    pass

        set_current_user(user)

        # Detect permanent deletion flag
        is_permanent = (
            request.GET.get('permanent', '').lower() in ('true', '1', 'yes') or
            request.META.get('HTTP_X_PERMANENT_DELETE', '').lower() in ('true', '1', 'yes')
        )
        set_bypass_recycle_bin(is_permanent)

        try:
            response = self.get_response(request)
        finally:
            set_current_user(None)
            set_bypass_recycle_bin(False)
        return response
