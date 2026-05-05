import os
import sys
import json
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','toystore.settings')
import django
django.setup()
from django.test import Client
c = Client()
resp = c.post('/api/auth/login/', json.dumps({'email':'admin@toystore.com','password':'Admin@123'}), content_type='application/json')
print('status', resp.status_code)
print(resp.content.decode())
