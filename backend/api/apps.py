from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        try:
            from .signals import register_recycle_bin_signals
            register_recycle_bin_signals()
        except Exception:
            pass
