#!/usr/bin/env python
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'toystore.settings')
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
django.setup()

from apps.products.models import Product, Category
from pathlib import Path

print("=" * 60)
print("THÔNG TIN SẢN PHẨM TRONG DATABASE")
print("=" * 60)

# Kiểm tra số lượng sản phẩm
print(f"\nTổng sản phẩm trong DB: {Product.objects.count()}")

# Hiển thị danh sách sản phẩm
print("\nDanh sách 10 sản phẩm đầu tiên:")
for i, p in enumerate(Product.objects.all()[:10], 1):
    print(f"  {i}. {p.name}")
    print(f"     - Image: {p.image}")
    print(f"     - Category: {p.category}")
    print()

# Kiểm tra thư mục ảnh đã tối ưu
optimized_dir = Path(r'd:\DuAnPy\Shop_do_choi\Shop_do_choi\media\products_optimized')
if optimized_dir.exists():
    images = list(optimized_dir.rglob('*.jpg'))
    print(f"\nTổng ảnh đã tối ưu hóa: {len(images)}")
    print("Danh sách ảnh tối ưu hóa:")
    for img in sorted(images)[:15]:
        rel_path = img.relative_to(optimized_dir.parent)
        print(f"  - {rel_path}")
else:
    print(f"\nThư mục tối ưu không tồn tại: {optimized_dir}")
