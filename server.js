/* ══════════════════════════════════════════
   QLSV — server.js
   Backend API Node.js + Express + SQL Server
══════════════════════════════════════════ */

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve static files (index.html, app.js, style.css) ──
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════════
// CẤU HÌNH KẾT NỐI SQL SERVER
// ══════════════════════════════════════════
const dbConfig = {
  server: 'localhost',
  database: 'QLSV',
  user: 'sa',
  password: 'abc@565656',
  options: {
    encrypt: false,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
    console.log('✅ Đã kết nối SQL Server thành công');
  }
  return pool;
}

// Helper xử lý lỗi
const handle = (res, fn) => fn().catch(err => {
  console.error('DB Error:', err.message);
  res.status(500).json({ error: err.message });
});

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
app.post('/api/login', (req, res) => handle(res, async () => {
  const { TenDangNhap, MatKhau } = req.body;
  const p = await getPool();
  const result = await p.request()
    .input('user', sql.NVarChar, TenDangNhap)
    .input('pass', sql.NVarChar, MatKhau)
    .query(`SELECT TenDangNhap, RTRIM(LoaiTaiKhoan) AS LoaiTaiKhoan, RTRIM(MaSV) AS MaSV
        FROM TaiKhoan
        WHERE TenDangNhap = @user AND MatKhau = @pass`);
  if (!result.recordset.length) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
  res.json(result.recordset[0]);
}));

// ══════════════════════════════════════════
// KHOA
// ══════════════════════════════════════════
app.get('/api/khoa', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM Khoa ORDER BY MaKhoa');
  res.json(r.recordset);
}));

app.post('/api/khoa', (req, res) => handle(res, async () => {
  const { MaKhoa, TenKhoa, DiaChi, Email, SoDienThoai, NgayThanhLap } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaKhoa', sql.Char(10), MaKhoa)
    .input('TenKhoa', sql.NVarChar(100), TenKhoa)
    .input('DiaChi', sql.NVarChar(200), DiaChi || null)
    .input('Email', sql.VarChar(100), Email || null)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('NgayThanhLap', sql.Date, NgayThanhLap)
    .query(`INSERT INTO Khoa (MaKhoa,TenKhoa,DiaChi,Email,SoDienThoai,NgayThanhLap)
            VALUES (@MaKhoa,@TenKhoa,@DiaChi,@Email,@SoDienThoai,@NgayThanhLap)`);
  res.json({ success: true });
}));

app.put('/api/khoa/:id', (req, res) => handle(res, async () => {
  const { TenKhoa, DiaChi, Email, SoDienThoai, NgayThanhLap } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaKhoa', sql.Char(10), req.params.id)
    .input('TenKhoa', sql.NVarChar(100), TenKhoa)
    .input('DiaChi', sql.NVarChar(200), DiaChi || null)
    .input('Email', sql.VarChar(100), Email || null)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('NgayThanhLap', sql.Date, NgayThanhLap)
    .query(`UPDATE Khoa SET TenKhoa=@TenKhoa, DiaChi=@DiaChi, Email=@Email,
            SoDienThoai=@SoDienThoai, NgayThanhLap=@NgayThanhLap WHERE MaKhoa=@MaKhoa`);
  res.json({ success: true });
}));

app.delete('/api/khoa/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  const t = new sql.Transaction(p);
  try {
    await t.begin();
    // Xóa chuỗi: DangKyHoc → LopHocPhan (qua GV) → GiangVien
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE dk FROM DangKyHoc dk INNER JOIN LopHocPhan lhp ON dk.MaLHP=lhp.MaLHP INNER JOIN GiangVien gv ON lhp.MaGV=gv.MaGV WHERE gv.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE lhp FROM LopHocPhan lhp INNER JOIN GiangVien gv ON lhp.MaGV=gv.MaGV WHERE gv.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE FROM GiangVien WHERE MaKhoa=@MaKhoa');
    // Xóa Lop → Nganh thuộc Khoa
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE dk FROM DangKyHoc dk INNER JOIN SinhVien sv ON dk.MaSV=sv.MaSV INNER JOIN Lop l ON sv.MaLop=l.MaLop INNER JOIN NganhHoc n ON l.MaNganh=n.MaNganh WHERE n.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE tk FROM TaiKhoan tk INNER JOIN SinhVien sv ON tk.MaSV=sv.MaSV INNER JOIN Lop l ON sv.MaLop=l.MaLop INNER JOIN NganhHoc n ON l.MaNganh=n.MaNganh WHERE n.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE sv FROM SinhVien sv INNER JOIN Lop l ON sv.MaLop=l.MaLop INNER JOIN NganhHoc n ON l.MaNganh=n.MaNganh WHERE n.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE l FROM Lop l INNER JOIN NganhHoc n ON l.MaNganh=n.MaNganh WHERE n.MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE FROM NganhHoc WHERE MaKhoa=@MaKhoa');
    await new sql.Request(t).input('MaKhoa', sql.Char(10), req.params.id)
      .query('DELETE FROM Khoa WHERE MaKhoa=@MaKhoa');
    await t.commit();
    res.json({ success: true });
  } catch(err) { await t.rollback(); throw err; }
}));

// ══════════════════════════════════════════
// NGÀNH HỌC
// ══════════════════════════════════════════
app.get('/api/nganh', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM NganhHoc ORDER BY MaNganh');
  res.json(r.recordset);
}));

app.post('/api/nganh', (req, res) => handle(res, async () => {
  const { MaNganh, TenNganh, MaKhoa, MoTa } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaNganh', sql.Char(10), MaNganh)
    .input('TenNganh', sql.NVarChar(100), TenNganh)
    .input('MaKhoa', sql.Char(10), MaKhoa)
    .input('MoTa', sql.NVarChar(300), MoTa || null)
    .query(`INSERT INTO NganhHoc (MaNganh,TenNganh,MaKhoa,MoTa)
            VALUES (@MaNganh,@TenNganh,@MaKhoa,@MoTa)`);
  res.json({ success: true });
}));

app.put('/api/nganh/:id', (req, res) => handle(res, async () => {
  const { TenNganh, MaKhoa, MoTa } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaNganh', sql.Char(10), req.params.id)
    .input('TenNganh', sql.NVarChar(100), TenNganh)
    .input('MaKhoa', sql.Char(10), MaKhoa)
    .input('MoTa', sql.NVarChar(300), MoTa || null)
    .query('UPDATE NganhHoc SET TenNganh=@TenNganh, MaKhoa=@MaKhoa, MoTa=@MoTa WHERE MaNganh=@MaNganh');
  res.json({ success: true });
}));

app.delete('/api/nganh/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  await p.request()
    .input('MaNganh', sql.Char(10), req.params.id)
    .query('DELETE FROM NganhHoc WHERE MaNganh=@MaNganh');
  res.json({ success: true });
}));

// ══════════════════════════════════════════
// LỚP
// ══════════════════════════════════════════
app.get('/api/lop', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT l.*, n.TenNganh FROM Lop l
    LEFT JOIN NganhHoc n ON l.MaNganh = n.MaNganh ORDER BY l.MaLop`);
  res.json(r.recordset);
}));

app.post('/api/lop', (req, res) => handle(res, async () => {
  const { MaLop, TenLop, MaNganh, NamNhapHoc, NgayNhapHoc } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaLop', sql.Char(10), MaLop)
    .input('TenLop', sql.NVarChar(50), TenLop)
    .input('MaNganh', sql.Char(10), MaNganh)
    .input('NamNhapHoc', sql.Int, NamNhapHoc)
    .input('NgayNhapHoc', sql.Date, NgayNhapHoc)
    .query(`INSERT INTO Lop (MaLop,TenLop,MaNganh,NamNhapHoc,NgayNhapHoc)
            VALUES (@MaLop,@TenLop,@MaNganh,@NamNhapHoc,@NgayNhapHoc)`);
  res.json({ success: true });
}));

app.put('/api/lop/:id', (req, res) => handle(res, async () => {
  const { TenLop, MaNganh, NamNhapHoc, NgayNhapHoc } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaLop', sql.Char(10), req.params.id)
    .input('TenLop', sql.NVarChar(50), TenLop)
    .input('MaNganh', sql.Char(10), MaNganh)
    .input('NamNhapHoc', sql.Int, NamNhapHoc)
    .input('NgayNhapHoc', sql.Date, NgayNhapHoc)
    .query(`UPDATE Lop SET TenLop=@TenLop, MaNganh=@MaNganh,
            NamNhapHoc=@NamNhapHoc, NgayNhapHoc=@NgayNhapHoc WHERE MaLop=@MaLop`);
  res.json({ success: true });
}));

app.delete('/api/lop/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  const t = new sql.Transaction(p);
  try {
    await t.begin();
    // Xóa DangKyHoc → TaiKhoan → SinhVien → Lop
    await new sql.Request(t).input('MaLop', sql.Char(10), req.params.id)
      .query('DELETE dk FROM DangKyHoc dk INNER JOIN SinhVien sv ON dk.MaSV=sv.MaSV WHERE sv.MaLop=@MaLop');
    await new sql.Request(t).input('MaLop', sql.Char(10), req.params.id)
      .query('DELETE tk FROM TaiKhoan tk INNER JOIN SinhVien sv ON tk.MaSV=sv.MaSV WHERE sv.MaLop=@MaLop');
    await new sql.Request(t).input('MaLop', sql.Char(10), req.params.id)
      .query('DELETE FROM SinhVien WHERE MaLop=@MaLop');
    await new sql.Request(t).input('MaLop', sql.Char(10), req.params.id)
      .query('DELETE FROM Lop WHERE MaLop=@MaLop');
    await t.commit();
    res.json({ success: true });
  } catch(err) { await t.rollback(); throw err; }
}));

// ══════════════════════════════════════════
// SINH VIÊN
// ══════════════════════════════════════════
app.get('/api/sinhvien', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM SinhVien ORDER BY MaSV');
  res.json(r.recordset);
}));

app.post('/api/sinhvien', (req, res) => handle(res, async () => {
  const { MaSV, HoTen, NgaySinh, GioiTinh, DiaChi, Email, SoDienThoai, MaLop, TrangThai } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaSV', sql.Char(10), MaSV)
    .input('HoTen', sql.NVarChar(100), HoTen)
    .input('NgaySinh', sql.Date, NgaySinh)
    .input('GioiTinh', sql.NVarChar(5), GioiTinh)
    .input('DiaChi', sql.NVarChar(200), DiaChi || null)
    .input('Email', sql.VarChar(100), Email)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('MaLop', sql.Char(10), MaLop)
    .input('TrangThai', sql.NVarChar(20), TrangThai || 'Đang học')
    .query(`INSERT INTO SinhVien (MaSV,HoTen,NgaySinh,GioiTinh,DiaChi,Email,SoDienThoai,MaLop,TrangThai)
            VALUES (@MaSV,@HoTen,@NgaySinh,@GioiTinh,@DiaChi,@Email,@SoDienThoai,@MaLop,@TrangThai)`);

  // Tạo tài khoản tự động (mật khẩu = ngày sinh ddMMyyyy)
  const parts = NgaySinh.split('-');
  const pw = parts[2] + parts[1] + parts[0]; // ddMMyyyy
  await p.request()
    .input('TenDangNhap', sql.NVarChar(50), MaSV)
    .input('MatKhau', sql.NVarChar(100), pw)
    .input('MaSV', sql.Char(10), MaSV)
    .query(`IF NOT EXISTS (SELECT 1 FROM TaiKhoan WHERE TenDangNhap=@TenDangNhap)
            INSERT INTO TaiKhoan (TenDangNhap,MatKhau,LoaiTaiKhoan,MaSV)
            VALUES (@TenDangNhap,@MatKhau,N'SinhVien',@MaSV)`);

  res.json({ success: true });
}));

app.put('/api/sinhvien/:id', (req, res) => handle(res, async () => {
  const { HoTen, NgaySinh, GioiTinh, DiaChi, Email, SoDienThoai, MaLop, TrangThai } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaSV', sql.Char(10), req.params.id)
    .input('HoTen', sql.NVarChar(100), HoTen)
    .input('NgaySinh', sql.Date, NgaySinh)
    .input('GioiTinh', sql.NVarChar(5), GioiTinh)
    .input('DiaChi', sql.NVarChar(200), DiaChi || null)
    .input('Email', sql.VarChar(100), Email)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('MaLop', sql.Char(10), MaLop)
    .input('TrangThai', sql.NVarChar(20), TrangThai)
    .query(`UPDATE SinhVien SET HoTen=@HoTen, NgaySinh=@NgaySinh, GioiTinh=@GioiTinh,
            DiaChi=@DiaChi, Email=@Email, SoDienThoai=@SoDienThoai,
            MaLop=@MaLop, TrangThai=@TrangThai WHERE MaSV=@MaSV`);
  res.json({ success: true });
}));

app.delete('/api/sinhvien/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  const t = new sql.Transaction(p);
  try {
    await t.begin();
    await new sql.Request(t).input('MaSV', sql.Char(10), req.params.id)
      .query('DELETE FROM DangKyHoc WHERE MaSV=@MaSV');
    await new sql.Request(t).input('MaSV', sql.Char(10), req.params.id)
      .query('DELETE FROM TaiKhoan WHERE MaSV=@MaSV');
    await new sql.Request(t).input('MaSV', sql.Char(10), req.params.id)
      .query('DELETE FROM SinhVien WHERE MaSV=@MaSV');
    await t.commit();
    res.json({ success: true });
  } catch (err) {
    await t.rollback();
    throw err;
  }
}));

// ══════════════════════════════════════════
// GIẢNG VIÊN
// ══════════════════════════════════════════
app.get('/api/giangvien', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM GiangVien ORDER BY MaGV');
  res.json(r.recordset);
}));

app.post('/api/giangvien', (req, res) => handle(res, async () => {
  const { MaGV, HoTen, NgaySinh, GioiTinh, HocVi, ChuyenNganh, Email, SoDienThoai, MaKhoa } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaGV', sql.Char(10), MaGV)
    .input('HoTen', sql.NVarChar(100), HoTen)
    .input('NgaySinh', sql.Date, NgaySinh)
    .input('GioiTinh', sql.NVarChar(5), GioiTinh)
    .input('HocVi', sql.NVarChar(30), HocVi)
    .input('ChuyenNganh', sql.NVarChar(100), ChuyenNganh)
    .input('Email', sql.VarChar(100), Email)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('MaKhoa', sql.Char(10), MaKhoa)
    .query(`INSERT INTO GiangVien (MaGV,HoTen,NgaySinh,GioiTinh,HocVi,ChuyenNganh,Email,SoDienThoai,MaKhoa)
            VALUES (@MaGV,@HoTen,@NgaySinh,@GioiTinh,@HocVi,@ChuyenNganh,@Email,@SoDienThoai,@MaKhoa)`);
  res.json({ success: true });
}));

app.put('/api/giangvien/:id', (req, res) => handle(res, async () => {
  const { HoTen, NgaySinh, GioiTinh, HocVi, ChuyenNganh, Email, SoDienThoai, MaKhoa } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaGV', sql.Char(10), req.params.id)
    .input('HoTen', sql.NVarChar(100), HoTen)
    .input('NgaySinh', sql.Date, NgaySinh)
    .input('GioiTinh', sql.NVarChar(5), GioiTinh)
    .input('HocVi', sql.NVarChar(30), HocVi)
    .input('ChuyenNganh', sql.NVarChar(100), ChuyenNganh)
    .input('Email', sql.VarChar(100), Email)
    .input('SoDienThoai', sql.VarChar(15), SoDienThoai || null)
    .input('MaKhoa', sql.Char(10), MaKhoa)
    .query(`UPDATE GiangVien SET HoTen=@HoTen, NgaySinh=@NgaySinh, GioiTinh=@GioiTinh,
            HocVi=@HocVi, ChuyenNganh=@ChuyenNganh, Email=@Email,
            SoDienThoai=@SoDienThoai, MaKhoa=@MaKhoa WHERE MaGV=@MaGV`);
  res.json({ success: true });
}));

app.delete('/api/giangvien/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  const t = new sql.Transaction(p);
  try {
    await t.begin();
    // Xóa DangKyHoc liên quan đến các LHP của GV này
    await new sql.Request(t).input('MaGV', sql.Char(10), req.params.id)
      .query('DELETE dk FROM DangKyHoc dk INNER JOIN LopHocPhan lhp ON dk.MaLHP=lhp.MaLHP WHERE lhp.MaGV=@MaGV');
    await new sql.Request(t).input('MaGV', sql.Char(10), req.params.id)
      .query('DELETE FROM LopHocPhan WHERE MaGV=@MaGV');
    await new sql.Request(t).input('MaGV', sql.Char(10), req.params.id)
      .query('DELETE FROM GiangVien WHERE MaGV=@MaGV');
    await t.commit();
    res.json({ success: true });
  } catch(err) { await t.rollback(); throw err; }
}));

// ══════════════════════════════════════════
// MÔN HỌC
// ══════════════════════════════════════════
app.get('/api/monhoc', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM MonHoc ORDER BY MaMH');
  res.json(r.recordset);
}));

app.post('/api/monhoc', (req, res) => handle(res, async () => {
  const { MaMH, TenMH, SoTinChi, MoTa, LoaiMon } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaMH', sql.Char(10), MaMH)
    .input('TenMH', sql.NVarChar(100), TenMH)
    .input('SoTinChi', sql.Int, SoTinChi)
    .input('MoTa', sql.NVarChar(300), MoTa || null)
    .input('LoaiMon', sql.NVarChar(20), LoaiMon || 'Bắt buộc')
    .query(`INSERT INTO MonHoc (MaMH,TenMH,SoTinChi,MoTa,LoaiMon)
            VALUES (@MaMH,@TenMH,@SoTinChi,@MoTa,@LoaiMon)`);
  res.json({ success: true });
}));

app.put('/api/monhoc/:id', (req, res) => handle(res, async () => {
  const { TenMH, SoTinChi, MoTa, LoaiMon } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaMH', sql.Char(10), req.params.id)
    .input('TenMH', sql.NVarChar(100), TenMH)
    .input('SoTinChi', sql.Int, SoTinChi)
    .input('MoTa', sql.NVarChar(300), MoTa || null)
    .input('LoaiMon', sql.NVarChar(20), LoaiMon)
    .query(`UPDATE MonHoc SET TenMH=@TenMH, SoTinChi=@SoTinChi,
            MoTa=@MoTa, LoaiMon=@LoaiMon WHERE MaMH=@MaMH`);
  res.json({ success: true });
}));

app.delete('/api/monhoc/:id', (req, res) => handle(res, async () => {
  const p = await getPool();
  const t = new sql.Transaction(p);
  try {
    await t.begin();
    await new sql.Request(t).input('MaMH', sql.Char(10), req.params.id)
      .query('DELETE dk FROM DangKyHoc dk INNER JOIN LopHocPhan lhp ON dk.MaLHP=lhp.MaLHP WHERE lhp.MaMH=@MaMH');
    await new sql.Request(t).input('MaMH', sql.Char(10), req.params.id)
      .query('DELETE FROM LopHocPhan WHERE MaMH=@MaMH');
    await new sql.Request(t).input('MaMH', sql.Char(10), req.params.id)
      .query('DELETE FROM ChuongTrinhDaoTao WHERE MaMH=@MaMH');
    await new sql.Request(t).input('MaMH', sql.Char(10), req.params.id)
      .query('DELETE FROM MonHoc WHERE MaMH=@MaMH');
    await t.commit();
    res.json({ success: true });
  } catch(err) { await t.rollback(); throw err; }
}));

// ══════════════════════════════════════════
// HỌC KỲ
// ══════════════════════════════════════════
app.get('/api/hocky', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query('SELECT * FROM HocKy ORDER BY MaHK');
  res.json(r.recordset);
}));

// ══════════════════════════════════════════
// LỚP HỌC PHẦN
// ══════════════════════════════════════════
app.get('/api/lophocphan', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT lhp.*, m.TenMH, g.HoTen AS TenGV, h.TenHK
    FROM LopHocPhan lhp
    LEFT JOIN MonHoc m ON lhp.MaMH = m.MaMH
    LEFT JOIN GiangVien g ON lhp.MaGV = g.MaGV
    LEFT JOIN HocKy h ON lhp.MaHK = h.MaHK
    ORDER BY lhp.MaLHP`);
  res.json(r.recordset);
}));

// ══════════════════════════════════════════
// ĐĂNG KÝ HỌC / ĐIỂM
// ══════════════════════════════════════════
app.get('/api/dangkyhoc', (req, res) => handle(res, async () => {
  const p = await getPool();
  const maSV = req.query.MaSV;
  let query = `
    SELECT dk.*, m.TenMH, m.SoTinChi, h.TenHK
    FROM DangKyHoc dk
    LEFT JOIN LopHocPhan lhp ON dk.MaLHP = lhp.MaLHP
    LEFT JOIN MonHoc m ON lhp.MaMH = m.MaMH
    LEFT JOIN HocKy h ON lhp.MaHK = h.MaHK`;
  if (maSV) query += ' WHERE dk.MaSV = @MaSV';
  query += ' ORDER BY dk.MaDK';
  const req2 = p.request();
  if (maSV) req2.input('MaSV', sql.Char(10), maSV);
  const r = await req2.query(query);
  res.json(r.recordset);
}));

app.put('/api/dangkyhoc/:id/diem', (req, res) => handle(res, async () => {
  const { DiemCC, DiemGiuaKy, DiemCuoiKy, TrangThai } = req.body;
  const p = await getPool();
  await p.request()
    .input('MaDK', sql.Int, req.params.id)
    .input('DiemCC', sql.Float, DiemCC ?? null)
    .input('DiemGiuaKy', sql.Float, DiemGiuaKy ?? null)
    .input('DiemCuoiKy', sql.Float, DiemCuoiKy ?? null)
    .input('TrangThai', sql.NVarChar(20), TrangThai)
    .query(`UPDATE DangKyHoc SET DiemCC=@DiemCC, DiemGiuaKy=@DiemGiuaKy,
            DiemCuoiKy=@DiemCuoiKy, TrangThai=@TrangThai WHERE MaDK=@MaDK`);
  res.json({ success: true });
}));

// Import nhiều sinh viên từ CSV/Excel
app.post('/api/sinhvien/import', (req, res) => handle(res, async () => {
  const rows = req.body; // array
  const p = await getPool();
  let ok = 0, fail = 0;
  const errors = [];

  for (const [i, row] of rows.entries()) {
    try {
      const parts = (row.NgaySinh || '2000-01-01').split('-');
      const pw = parts[2] + parts[1] + parts[0];
      await p.request()
        .input('MaSV', sql.Char(10), row.MaSV)
        .input('HoTen', sql.NVarChar(100), row.HoTen)
        .input('NgaySinh', sql.Date, row.NgaySinh || '2000-01-01')
        .input('GioiTinh', sql.NVarChar(5), row.GioiTinh || 'Nam')
        .input('DiaChi', sql.NVarChar(200), row.DiaChi || null)
        .input('Email', sql.VarChar(100), row.Email)
        .input('SoDienThoai', sql.VarChar(15), row.SoDienThoai || null)
        .input('MaLop', sql.Char(10), row.MaLop)
        .input('TrangThai', sql.NVarChar(20), row.TrangThai || 'Đang học')
        .query(`INSERT INTO SinhVien (MaSV,HoTen,NgaySinh,GioiTinh,DiaChi,Email,SoDienThoai,MaLop,TrangThai)
                VALUES (@MaSV,@HoTen,@NgaySinh,@GioiTinh,@DiaChi,@Email,@SoDienThoai,@MaLop,@TrangThai)`);
      await p.request()
        .input('TenDangNhap', sql.NVarChar(50), row.MaSV)
        .input('MatKhau', sql.NVarChar(100), pw)
        .input('MaSV', sql.Char(10), row.MaSV)
        .query(`IF NOT EXISTS (SELECT 1 FROM TaiKhoan WHERE TenDangNhap=@TenDangNhap)
                INSERT INTO TaiKhoan (TenDangNhap,MatKhau,LoaiTaiKhoan,MaSV)
                VALUES (@TenDangNhap,@MatKhau,N'SinhVien',@MaSV)`);
      ok++;
    } catch (err) {
      errors.push(`Dòng ${i + 1}: ${err.message}`);
      fail++;
    }
  }
  res.json({ ok, fail, errors });
}));

// ══════════════════════════════════════════
// LOAD ALL DATA (dùng khi khởi động app)
// ══════════════════════════════════════════
app.get('/api/all', (req, res) => handle(res, async () => {
  const p = await getPool();
  const [khoa, nganh, lop, sinhvien, giangvien, monhoc, hocky, lophocphan, dangkyhoc] = await Promise.all([
  p.request().query('SELECT RTRIM(MaKhoa) AS MaKhoa, TenKhoa, DiaChi, Email, SoDienThoai, NgayThanhLap FROM Khoa ORDER BY MaKhoa'),
  p.request().query('SELECT RTRIM(MaNganh) AS MaNganh, TenNganh, RTRIM(MaKhoa) AS MaKhoa, MoTa FROM NganhHoc ORDER BY MaNganh'),
  p.request().query('SELECT RTRIM(MaLop) AS MaLop, TenLop, RTRIM(MaNganh) AS MaNganh, NamNhapHoc, NgayNhapHoc FROM Lop ORDER BY MaLop'),
  p.request().query('SELECT RTRIM(MaSV) AS MaSV, HoTen, NgaySinh, GioiTinh, DiaChi, Email, SoDienThoai, RTRIM(MaLop) AS MaLop, TrangThai, NgayNhapHocThucTe FROM SinhVien ORDER BY MaSV'),
  p.request().query('SELECT RTRIM(MaGV) AS MaGV, HoTen, NgaySinh, GioiTinh, HocVi, ChuyenNganh, Email, SoDienThoai, RTRIM(MaKhoa) AS MaKhoa FROM GiangVien ORDER BY MaGV'),
  p.request().query('SELECT RTRIM(MaMH) AS MaMH, TenMH, SoTinChi, MoTa, LoaiMon FROM MonHoc ORDER BY MaMH'),
  p.request().query('SELECT RTRIM(MaHK) AS MaHK, TenHK, NgayBatDau, NgayKetThuc, NamHoc FROM HocKy ORDER BY MaHK'),
  p.request().query('SELECT RTRIM(MaLHP) AS MaLHP, RTRIM(MaMH) AS MaMH, RTRIM(MaGV) AS MaGV, RTRIM(MaHK) AS MaHK, PhongHoc, LichHoc, SiSoToiDa FROM LopHocPhan ORDER BY MaLHP'),
  p.request().query('SELECT MaDK, RTRIM(MaSV) AS MaSV, RTRIM(MaLHP) AS MaLHP, NgayDangKy, DiemCC, DiemGiuaKy, DiemCuoiKy, DiemTongKet, TrangThai FROM DangKyHoc ORDER BY MaDK'),
]);

  // Format date fields
  const fmt = (arr, fields) => arr.map(r => {
    const obj = { ...r };
    fields.forEach(f => {
      if (obj[f] instanceof Date) obj[f] = obj[f].toISOString().split('T')[0];
    });
    return obj;
  });

  res.json({
    khoa:        fmt(khoa.recordset,        ['NgayThanhLap']),
    nganh:       nganh.recordset,
    lop:         fmt(lop.recordset,         ['NgayNhapHoc']),
    sinhvien:    fmt(sinhvien.recordset,    ['NgaySinh', 'NgayNhapHocThucTe']),
    giangvien:   fmt(giangvien.recordset,   ['NgaySinh']),
    monhoc:      monhoc.recordset,
    hocky:       fmt(hocky.recordset,       ['NgayBatDau', 'NgayKetThuc']),
    lophocphan:  lophocphan.recordset,
    dangkyhoc:   fmt(dangkyhoc.recordset,   ['NgayDangKy']),
  });
}));

// ══════════════════════════════════════════
// STATS cho Dashboard
// ══════════════════════════════════════════
app.get('/api/stats', (req, res) => handle(res, async () => {
  const p = await getPool();
  const r = await p.request().query(`
    SELECT
      (SELECT COUNT(*) FROM SinhVien)  AS totalSV,
      (SELECT COUNT(*) FROM GiangVien) AS totalGV,
      (SELECT COUNT(*) FROM MonHoc)    AS totalMH,
      (SELECT COUNT(*) FROM Khoa)      AS totalKhoa
  `);
  res.json(r.recordset[0]);
}));

// ══════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 QLSV Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/api/all`);
});
