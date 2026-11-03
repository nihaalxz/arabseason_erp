"""
Complete Database Reset Script for Arab Season ERP
==================================================
Wipes all transactional, operational, and master records from all sections
across the entire database without adding any seed data.
Retains only the administrative superuser account (admin / admin123).
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.apps import apps
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session

User = get_user_model()

def reset_database():
    print("==========================================================")
    print("WIPING ALL DATA FROM ALL SECTIONS (COMPLETE DATABASE RESET)")
    print("==========================================================")

    # 1. Clear all models in the 'api' app
    api_app = apps.get_app_config('api')
    # Sort models by reverse dependency or delete repeatedly until all 0
    all_api_models = list(api_app.get_models())

    # Delete in loop to respect any foreign key constraints
    for attempt in range(5):
        cleared_any = False
        for model in all_api_models:
            count = model.objects.count()
            if count > 0:
                try:
                    model.objects.all().delete()
                    print(f"  [WIPED] {model.__name__}: {count} records deleted.")
                    cleared_any = True
                except Exception as e:
                    # Retry in subsequent pass
                    pass
        if not cleared_any:
            break

    # Final check on api models
    remaining_api = []
    for model in all_api_models:
        count = model.objects.count()
        if count > 0:
            remaining_api.append((model.__name__, count))

    if remaining_api:
        print(f"  [WARNING] Remaining items in api models: {remaining_api}")
        for name, _ in remaining_api:
            model = getattr(api_app.models, name.lower(), None)
            if model:
                model.objects.all().delete()
    else:
        print("[OK] All tables in API app are completely empty (0 records).")

    # 2. Clear Sessions
    Session.objects.all().delete()
    print("[OK] All browser sessions cleared.")

    # 3. Clean up Users: Keep only the main 'admin' superuser
    admin_user, created = User.objects.get_or_create(username='admin')
    admin_user.set_password('admin123')
    admin_user.email = 'admin@arabseason.com'
    admin_user.first_name = 'Arab'
    admin_user.last_name = 'Admin'
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    if hasattr(admin_user, 'role'):
        admin_user.role = 'Admin'
    admin_user.save()
    print(f"[OK] Master admin superuser verified: username='admin', password='admin123'")

    # Delete all other dummy/test users
    deleted_users = User.objects.exclude(username='admin').delete()
    print(f"[OK] Test / dummy user accounts removed: {deleted_users[0]} users deleted.")

    # 4. Final verification of all model counts
    print("\n==========================================================")
    print("FINAL DATABASE AUDIT (VERIFYING 0 RECORDS EVERYWHERE)")
    print("==========================================================")
    non_zero = []
    for model in api_app.get_models():
        count = model.objects.count()
        print(f"  {model.__name__:<25}: {count} records")
        if count > 0:
            non_zero.append((model.__name__, count))

    print(f"\n  Active Users in Database: {User.objects.count()} (admin only)")
    for u in User.objects.all():
        print(f"    - {u.username} (superuser={u.is_superuser}, staff={u.is_staff})")

    if not non_zero:
        print("\n==========================================================")
        print("DATABASE IS 100% CLEAN AND COMPLETELY RESET. NO SEED DATA.")
        print("==========================================================")
    else:
        print(f"\n[ALERT] Some models still have records: {non_zero}")

if __name__ == '__main__':
    reset_database()

