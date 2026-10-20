import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
username = 'admin'
password = 'admin123'

user, created = User.objects.get_or_create(username=username)
user.set_password(password)
user.is_staff = True
user.is_superuser = True
user.save()

print(f"User '{username}' updated/created with password '{password}'")
