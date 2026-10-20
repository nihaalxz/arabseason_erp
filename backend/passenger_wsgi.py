import os
import sys
import traceback

# Path to the application directory
sys.path.insert(0, os.path.dirname(__file__))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception as e:
    err_msg = traceback.format_exc()
    try:
        with open(os.path.join(os.path.dirname(__file__), 'wsgi_error.log'), 'a') as f:
            f.write(f"\n--- WSGI ERROR ---\n{err_msg}\n")
    except Exception:
        pass
    
    def application(environ, start_response):
        start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
        return [f"WSGI Startup Error:\n{err_msg}".encode('utf-8')]
