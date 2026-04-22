# QLSV — Hướng dẫn kết nối SQL Server

## 📁 Cấu trúc thư mục sau khi setup

```
qlsv/
├── server.js          ← Backend Node.js (FILE MỚI)
├── package.json       ← Dependencies (FILE MỚI)
├── public/            ← Tạo thư mục này, chứa frontend
│   ├── index.html
│   ├── app.js         ← Dùng file app_new.js (đổi tên)
│   └── style.css
└── README_SETUP.md
```

---

## ⚙️ BƯỚC 1 — Cài Node.js (nếu chưa có)

Tải tại: https://nodejs.org  
Chọn **LTS version** → cài đặt bình thường.

Kiểm tra:
```bash
node --version    # v18.x hoặc cao hơn
npm --version
```

---

## 🗄️ BƯỚC 2 — Chuẩn bị SQL Server

### 2.1. Chạy file SQL để tạo database
Mở **SQL Server Management Studio (SSMS)**, mở file `SQLQuery1_TEST.sql` và chạy (F5).  
Database `QLSV` sẽ được tạo với đầy đủ bảng và dữ liệu mẫu.

### 2.2. Bật SQL Server Authentication
Trong SSMS:
1. Chuột phải vào server → **Properties** → **Security**
2. Chọn **SQL Server and Windows Authentication mode**
3. Nhấn OK → Khởi động lại SQL Server service

### 2.3. Tạo user hoặc dùng user `sa`
Nếu dùng `sa`, đảm bảo tài khoản được bật:
```sql
ALTER LOGIN sa ENABLE;
ALTER LOGIN sa WITH PASSWORD = '123456';  -- đổi password tùy ý
```

---

## 📝 BƯỚC 3 — Cấu hình server.js

Mở `server.js`, tìm phần `dbConfig` và sửa:

```javascript
const dbConfig = {
  server: 'localhost',      // hoặc: localhost\\SQLEXPRESS
  database: 'QLSV',
  user: 'sa',               // ← tên user SQL của bạn
  password: '123456',       // ← password SQL của bạn
  options: {
    encrypt: false,
    trustServerCertificate: true,
  }
};
```

> **Lưu ý tên instance:**  
> - SQL Server Developer/Express: thường là `localhost\\SQLEXPRESS`  
> - SQL Server (đầy đủ): thường là `localhost`  
> Kiểm tra trong SSMS ở thanh title bar.

---

## 📂 BƯỚC 4 — Đặt file đúng vị trí

```
1. Tạo thư mục mới, ví dụ: C:\qlsv\

2. Copy vào thư mục đó:
   - server.js
   - package.json

3. Tạo thư mục con: C:\qlsv\public\

4. Copy vào public\:
   - index.html
   - style.css
   - app_new.js  →  đổi tên thành  app.js

5. Mở index.html, đảm bảo dòng script trỏ đúng:
   <script src="app.js"></script>
```

---

## 🚀 BƯỚC 5 — Cài dependencies và chạy

Mở **Command Prompt** hoặc **Terminal**, vào thư mục dự án:

```bash
cd C:\qlsv

# Cài thư viện
npm install

# Chạy server
node server.js
```

Nếu thành công sẽ thấy:
```
✅ Đã kết nối SQL Server thành công
🚀 QLSV Server đang chạy tại http://localhost:3000
```

Mở trình duyệt: **http://localhost:3000**

---

## 🔑 Tài khoản đăng nhập

| Tài khoản | Mật khẩu | Quyền |
|-----------|----------|-------|
| admin | 1 | Quản trị viên |
| SV2100001 | 12052003 | Sinh viên |
| SV2100002 | 20072003 | Sinh viên |

*(Mật khẩu sinh viên = ngày sinh định dạng ddMMyyyy)*

---

## ⚡ Chạy tự động với nodemon (khuyến nghị khi dev)

```bash
npm run dev
# Server tự restart khi sửa code
```

---

## ❌ Xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `ConnectionError: Failed to connect` | Sai server/port | Kiểm tra tên instance SQL Server |
| `Login failed for user 'sa'` | Sai mật khẩu hoặc chưa bật SQL Auth | Xem Bước 2.2 và 2.3 |
| `Cannot open database "QLSV"` | Chưa chạy file SQL | Chạy SQLQuery1_TEST.sql trước |
| `EADDRINUSE port 3000` | Port đã bị dùng | Sửa PORT trong server.js |
| Trang trắng / lỗi fetch | API chưa chạy | Đảm bảo `node server.js` đang chạy |

---

## 🔧 Thay đổi port

Trong `server.js`:
```javascript
const PORT = process.env.PORT || 3000;  // đổi 3000 thành port khác
```
