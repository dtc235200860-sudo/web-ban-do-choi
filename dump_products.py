import os, sys, json
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
os.environ.setdefault('DJANGO_SETTINGS_MODULE','toystore.settings')
import django
django.setup()
from apps.products.models import Product
from apps.products.serializers import ProductSerializer
from django.test import RequestFactory
products = Product.objects.all()[:5]
for p in products:
    data = ProductSerializer(p, context={}).data
    print(json.dumps(data, ensure_ascii=False, indent=2))
