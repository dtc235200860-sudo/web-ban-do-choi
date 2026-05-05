import os
import sys
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','toystore.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
checks = [
    ('admin@toystore.com','Admin@123'),
    ('user1@toystore.com','User@123'),
]
for email,password in checks:
    try:
        u = User.objects.get(email__iexact=email)
        print(email, 'stored=', u.password[:30] + '...' if u.password else '(no password)', 'check=', u.check_password(password))
    except User.DoesNotExist:
        print(email, 'not found')
    except Exception as e:
        print('error', email, e)
