import os, sys, django
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import SiteSettings
settings = SiteSettings.objects.first()
if settings:
    print('DATABASE SITE SETTINGS:')
    print('  company_legal_name:', getattr(settings, 'company_legal_name', None))
    print('  trn:', getattr(settings, 'trn', None))
    print('  phone:', getattr(settings, 'phone', None))
    print('  email:', getattr(settings, 'email', None))
    print('  website:', getattr(settings, 'website', None))
    print('  address:', getattr(settings, 'address', None))
else:
    print('No SiteSettings row found in DB.')

