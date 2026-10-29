import os
import re
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import JobOrder, CashBookEntry, Notification

print("--- Migrating JobOrder order_id ---")
for j in JobOrder.objects.all().order_by('id'):
    old_id = j.order_id or ''
    m = re.search(r'\d+', old_id)
    if m:
        num = int(m.group())
        new_id = f"JOB{num:04d}"
        print(f"Job {j.id}: {old_id} -> {new_id}")
        j.order_id = new_id
        j.save(update_fields=['order_id'])

print("--- Updating CashBookEntry remarks ---")
for cb in CashBookEntry.objects.filter(remark__contains='#OCT'):
    old_remark = cb.remark
    # Replace #OCT01 -> JOB0001, etc.
    new_remark = re.sub(r'#OCT(\d+)', lambda m: f"JOB{int(m.group(1)):04d}", old_remark)
    print(f"CB {cb.id}: {old_remark} -> {new_remark}")
    cb.remark = new_remark
    cb.save(update_fields=['remark'])

print("--- Updating Notification messages ---")
for n in Notification.objects.filter(message__contains='#OCT'):
    old_msg = n.message
    new_msg = re.sub(r'#OCT(\d+)', lambda m: f"JOB{int(m.group(1)):04d}", old_msg)
    n.message = new_msg
    if n.action_data and isinstance(n.action_data, dict) and 'order_id' in n.action_data:
        old_action_order = n.action_data.get('order_id')
        if old_action_order and '#OCT' in str(old_action_order):
            n.action_data['order_id'] = re.sub(r'#OCT(\d+)', lambda m: f"JOB{int(m.group(1)):04d}", str(old_action_order))
    n.save()

print("Migration completed successfully!")
