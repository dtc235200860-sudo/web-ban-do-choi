# ToyLand - Website bán đồ chơi trẻ em

ToyLand là website bán đồ chơi trẻ em với giao diện storefront và dashboard quản trị. Dự án này đã được chuyển backend sang Django + Django REST Framework, đồng thời giữ nguyên giao diện HTML/CSS hiện có và chỉ cập nhật tối thiểu phần `frontend/js/script.js` để làm việc với session, CSRF và API mới.

## Công nghệ sử dụng

- Python 3.10+
- Django 4.2+
- Django REST Framework
- SQLite
- django-cors-headers
- Pillow
- python-dotenv
- djangorestframework-simplejwt
- Frontend HTML/CSS/JavaScript thuần
- Gemini API 2.5 Flash cho chatbot

## Cấu trúc thư mục

```text
Shop_do_choi/
├── manage.py
├── requirements.txt
├── README.md
├── .env
├── toystore/
│   ├── __init__.py
│   ├── api.py
│   ├── settings.py
│   ├── urls.py
│   ├── views.py
│   ├── seeding.py
│   └── wsgi.py
├── apps/
│   ├── accounts/
│   ├── products/
│   ├── orders/
│   ├── coupons/
│   └── reviews/
├── ai/
│   ├── chatbot.py
│   └── recommendation.py
├── backend/              # backend cũ giữ lại để tham chiếu
├── database/
│   └── db.sqlite3
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
├── media/
│   ├── products/
│   └── banners/
└── management/
    └── commands/
        └── seed_data.py
```

## Hướng dẫn cài đặt

1. Tạo môi trường ảo:

```bash
python -m venv .venv
```

2. Kích hoạt môi trường ảo:

```bash
.venv\\Scripts\\activate
```

3. Cài dependencies:

```bash
pip install -r requirements.txt
```

4. Cập nhật file `.env`:

```env
DEBUG=1
SECRET_KEY=django-insecure-toystore-dev-secret-key
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,0.0.0.0
GEMINI_API_KEY=your_gemini_api_key_here
```

5. Tạo bảng database:

```bash
python manage.py migrate --run-syncdb
```

6. Seed dữ liệu mẫu:

```bash
python manage.py seed_data
```

7. Chạy server:

```bash
python manage.py runserver 0.0.0.0:8000
```

Sau đó mở:

- `http://127.0.0.1:8000`
- hoặc `http://<ip-máy-bạn>:8000` để máy khác trong cùng Wi-Fi truy cập

## Tài khoản mẫu

- Admin:
  - Email: `admin@toystore.com`
  - Password: `Admin@123`

- User 1:
  - Email: `user1@toystore.com`
  - Password: `User@123`

- User 2:
  - Email: `user2@toystore.com`
  - Password: `User@123`

## API endpoints

### Xác thực

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/logout/`
- `POST /api/auth/forgot-password/`
- `POST /api/auth/reset-password/`

### Sản phẩm

- `GET /api/products/`
- `POST /api/products/`
- `GET /api/products/:id/`
- `PUT /api/products/:id/`
- `DELETE /api/products/:id/`

### Danh mục

- `GET /api/categories/`
- `POST /api/categories/`
- `PUT /api/categories/:id/`
- `DELETE /api/categories/:id/`

### Đơn hàng

- `GET /api/orders/`
- `POST /api/orders/`
- `GET /api/orders/:id/`
- `PUT /api/orders/:id/`
- `GET /api/orders/all/`

### Đánh giá

- `GET /api/reviews/?product=:id`
- `POST /api/reviews/`
- `DELETE /api/reviews/:id/`

### Coupon

- `GET /api/coupons/`
- `POST /api/coupons/`
- `DELETE /api/coupons/:id/`
- `POST /api/coupons/apply/`

### Banner & cấu hình

- `GET /api/banners/`
- `GET /api/config/`
- `PUT /api/config/`

### Chat AI

- `POST /api/chat/gemini/`

### Reports

- `GET /api/reports/revenue/`
- `GET /api/reports/inventory/`
- `GET /api/reports/top-products/`
- `GET /api/reports/orders-stats/`

### Media

- `GET /api/media/toys/`
- `GET /api/media/banners/`

## Lưu ý vận hành

- `frontend/index.html` và CSS được giữ nguyên.
- `frontend/js/script.js` chỉ chỉnh các phần `apiJson`, `handleLogin`, `handleRegister` để hỗ trợ CSRF và auth backend mới.
- API phản hồi thống nhất theo format:

```json
{"ok": true, "data": ...}
```

hoặc:

```json
{"ok": false, "error": "..."}
```

- Upload ảnh sản phẩm hỗ trợ `jpg`, `jpeg`, `png`, `webp`, tối đa `5MB`.
- Chat Gemini đọc key từ `.env` qua biến `GEMINI_API_KEY`.
