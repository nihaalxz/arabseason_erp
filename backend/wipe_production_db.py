"""
Complete Production Database Wipe & Re-migration Script
======================================================
Usage:
    python wipe_production_db.py

What this script does:
1. Drops EVERY table in the connected database (including django_migrations).
2. Runs `python manage.py migrate` from scratch (0001 -> 0056).
3. Creates the master superuser account (admin / admin123).
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.db import connection
from django.core.management import call_command
from django.contrib.auth import get_user_model

def wipe_database():
    print("=" * 60)
    print("DANGER: Wiping all tables and rebuilding schema from scratch")
    print("=" * 60)

    vendor = connection.vendor
    print(f"Database Engine: {vendor}")

    with connection.cursor() as cursor:
        if vendor == 'sqlite':
            cursor.execute("PRAGMA foreign_keys = OFF;")
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [row[0] for row in cursor.fetchall()]
            for t in tables:
                cursor.execute(f'DROP TABLE IF EXISTS "{t}";')
                print(f"  [DROPPED] {t}")
            cursor.execute("PRAGMA foreign_keys = ON;")
        else:
            # MySQL / MariaDB / PostgreSQL
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE();")
            tables = [row[0] for row in cursor.fetchall()]
            for t in tables:
                cursor.execute(f"DROP TABLE IF EXISTS `{t}`;")
                print(f"  [DROPPED] {t}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

    print(f"\n[OK] Dropped {len(tables)} tables. Database is completely empty.")

    print("\n" + "=" * 60)
    print("RUNNING ALL MIGRATIONS FROM SCRATCH")
    print("=" * 60)
    call_command('migrate', interactive=False)

    print("\n" + "=" * 60)
    print("CREATING MASTER SUPERUSER (admin / admin123)")
    print("=" * 60)
    User = get_user_model()
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
    print("[OK] Superuser 'admin' created successfully (Password: admin123).")

    print("\n" + "=" * 60)
    print("PRODUCTION DATABASE WIPE & REBUILD COMPLETE!")
    print("=" * 60)

if __name__ == '__main__':
    wipe_database()

