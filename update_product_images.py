#!/usr/bin/env python
import os
import sys
import django
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'toystore.settings')
sys.path.insert(0, r'd:\DuAnPy\Shop_do_choi\Shop_do_choi')
django.setup()

from apps.products.models import Product
from django.core.files.storage import default_storage

# Mapping từ tên file ảnh gốc → tên file tối ưu (công thức chuyển đổi)
def normalize_filename(name):
    """Chuyển đổi tên file để khớp với ảnh tối ưu hóa"""
    return Path(name).stem  # Chỉ lấy tên, bỏ đuôi

# Danh sách ảnh tối ưu hóa (trích từ output)
optimized_images = {
    'bup-be-barbie': 'products_optimized/gau bong/bup-be-barbie.jpg',
    'gau-bong-baby-teddy-trang': 'products_optimized/gau bong/gau-bong-Baby-teddy-trang.jpg',
    'gau-bong-mom-long-xu': 'products_optimized/gau bong/gau-bong-MOM-long-xu.jpg',
    'mo-hinh-bup-be': 'products_optimized/gau bong/mo-hinh-bup-be.jpg',
    'do-choi-lap-ghep-ki-thuat-bang-go': 'products_optimized/sang tao/do-choi-lap-ghep-ki-thuat-bang-go.jpg',
    'khoi-rubick': 'products_optimized/sang tao/khoi-rubick.jpg',
    'xe-dieu-khien-rc': 'products_optimized/xe do choi/xe-dieu-khien-rc.jpg',
    'rc-off-road-truck': 'products_optimized/xe do choi/RC-Off-road Truck.jpg',
    'mo-hinh-lap-rap-mgex-7701-strike-freedom-midnight-coating': 'products_optimized/xep hinh/Mo-Hinh-Lap-Rap-MGEX-7701-Strike-Freedom-Midnight-Coating.jpg',
    'bo-lap-rap-lego-tre-em-ninjago-legacy-tau-bay': 'products_optimized/xep hinh/bo-lap-rap-lego-tre-em-ninjago-legacy-tau-bay.jpg',
}

print("=" * 80)
print("CẬP NHẬT ẢNH SẢN PHẨM - SỬ DỤNG ẢNH TỐI ƯU HÓA 4K")
print("=" * 80)

updated_count = 0
for product in Product.objects.all():
    # Lấy tên file gốc và chuẩn hóa
    original_image = str(product.image).strip()
    if not original_image:
        print(f"\n❌ {product.name}: Không có ảnh gốc")
        continue
    
    # Khớp với ảnh tối ưu hóa
    normalized = normalize_filename(original_image)
    
    if normalized in optimized_images:
        new_image_path = optimized_images[normalized]
        print(f"\n✅ {product.name}")
        print(f"   Từ: {original_image}")
        print(f"   Đến: {new_image_path}")
        
        # Cập nhật database
        product.image = new_image_path
        product.save(update_fields=['image'])
        updated_count += 1
    else:
        print(f"\n⚠️  {product.name}: Không tìm được ảnh tối ưu ({normalized})")
        # Hiển thị các khóa có sẵn để debug
        print(f"   Khóa có sẵn: {list(optimized_images.keys())[:3]}...")

print("\n" + "=" * 80)
print(f"✅ ĐÃ CẬP NHẬT {updated_count}/{Product.objects.count()} sản phẩm")
print("=" * 80)

# Kiểm tra kết quả
print("\n📋 KIỂM TRA KẾT QUẢ:")
for product in Product.objects.all():
    print(f"  - {product.name}: {product.image}")
