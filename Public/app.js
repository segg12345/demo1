/* ══════════════════════════════════════════
   QLSV — app.js (phiên bản kết nối SQL Server)
   Tất cả CRUD gọi REST API thay vì localStorage
══════════════════════════════════════════ */

const API = ''; // Để trống = cùng origin (server.js serve cả frontend)
               // Nếu chạy khác port thì đổi: const API = 'http://localhost:3000'

// ══════════════════════════════════════════
// API HELPERS
// ══════════════════════════════════════════
async function apiFetch(url, options = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi server');
  return data;
}
const apiGet    = url         => apiFetch(url);
const apiPost   = (url, body) => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) });
const apiPut    = (url, body) => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) });
const apiDelete = url         => apiFetch(url, { method: 'DELETE' });

// ══════════════════════════════════════════
// STATE
// ══════════════════════════════════════════
let DB = {
  khoa:[], nganh:[], lop:[], sinhvien:[], giangvien:[],
  monhoc:[], hocky:[], lophocphan:[], dangkyhoc:[]
};
let currentUser = null;
let svPage = 1;
const SV_PER_PAGE = 10;

// ══════════════════════════════════════════
// LOAD ALL DATA FROM API
// ══════════════════════════════════════════
async function loadDB() {
  try {
    DB = await apiGet('/api/all');
  } catch(err) {
    toast('Không thể kết nối server: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════
// LOOKUP HELPERS
// ══════════════════════════════════════════
const getLop   = id => DB.lop.find(l => l.MaLop === id?.trim()) || {};
const getNganh = id => DB.nganh.find(n => n.MaNganh === id?.trim()) || {};
const getKhoa  = id => DB.khoa.find(k => k.MaKhoa === id?.trim()) || {};
const getMH    = id => DB.monhoc.find(m => m.MaMH === id?.trim()) || {};
const getLHP   = id => DB.lophocphan.find(l => l.MaLHP === id?.trim()) || {};
const getHK    = id => DB.hocky.find(h => h.MaHK === id?.trim()) || {};
const getGV    = id => DB.giangvien.find(g => g.MaGV === id?.trim()) || {};
const getSV    = id => DB.sinhvien.find(s => s.MaSV === id?.trim());

function calcDiem(dk) {
  if (dk.DiemCC==null||dk.DiemGiuaKy==null||dk.DiemCuoiKy==null) return null;
  return Math.round((dk.DiemCC*0.1 + dk.DiemGiuaKy*0.3 + dk.DiemCuoiKy*0.6)*100)/100;
}

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  try {
    const acc = await apiPost('/api/login', { TenDangNhap: user, MatKhau: pass });
    document.getElementById('loginError').classList.add('hidden');
    currentUser = acc;
    await loadDB();
    startApp();
  } catch(err) {
    document.getElementById('loginError').classList.remove('hidden');
  }
}

function doLogout() {
  currentUser = null;
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('loginScreen').classList.add('active');
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
}

function togglePw() {
  const inp = document.getElementById('loginPass');
  const ico = document.getElementById('eyeIcon');
  if (inp.type==='password') { inp.type='text'; ico.className='fas fa-eye-slash'; }
  else { inp.type='password'; ico.className='fas fa-eye'; }
}

// ══════════════════════════════════════════
// APP START
// ══════════════════════════════════════════
function startApp() {
  const isAdmin = currentUser.LoaiTaiKhoan === 'Admin';
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.student-only').forEach(el => el.style.display = isAdmin ? 'none' : '');
  let name, role;
  if (isAdmin) { name='Admin'; role='Quản trị viên'; }
  else {
    const sv = getSV(currentUser.MaSV);
    name = sv ? sv.HoTen : currentUser.TenDangNhap;
    role = 'Sinh viên – ' + (sv ? sv.MaLop : '');
  }
  document.getElementById('userAvatar').textContent = name.split(' ').pop()[0].toUpperCase();
  document.getElementById('userNameDisplay').textContent = name;
  document.getElementById('userRoleDisplay').textContent = role;
  document.getElementById('topRole').textContent = isAdmin ? 'Admin' : 'Sinh viên';
  const defTab = isAdmin ? 'dashboard' : 'myinfo';
  switchTab(defTab, document.querySelector(`[data-tab="${defTab}"]`));
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
const tabTitles = {
  dashboard:'Dashboard', sinhvien:'Sinh viên', giangvien:'Giảng viên',
  monhoc:'Môn học', lop:'Lớp học', khoa:'Khoa', diemsv:'Điểm – Đăng ký học',
  import:'Import dữ liệu', myinfo:'Hồ sơ cá nhân', mydiem:'Bảng điểm', mylop:'Môn đã đăng ký'
};

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-'+tabId).classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = tabTitles[tabId]||tabId;
  renderTab(tabId);
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function renderTab(id) {
  switch(id) {
    case 'dashboard': renderDashboard(); break;
    case 'sinhvien':  populateSVFilters(); renderSinhVienTable(); break;
    case 'giangvien': renderGVTable(); break;
    case 'monhoc':    renderMHTable(); break;
    case 'lop':       renderLopTable(); break;
    case 'khoa':      renderKhoaTable(); break;
    case 'diemsv':    renderDiemAdmin(); break;
    case 'myinfo':    renderMyInfo(); break;
    case 'mydiem':    renderMyDiem(); break;
    case 'mylop':     renderMyLop(); break;
  }
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 768) sb.classList.toggle('mobile-open');
  else sb.classList.toggle('collapsed');
}

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
function renderDashboard() {
  const isAdmin = currentUser.LoaiTaiKhoan === 'Admin';
  const sg = document.getElementById('statsGrid');
  if (isAdmin) {
    sg.innerHTML = `
      ${statCard('fa-user-graduate','blue',DB.sinhvien.length,'Tổng sinh viên')}
      ${statCard('fa-chalkboard-user','green',DB.giangvien.length,'Giảng viên')}
      ${statCard('fa-book-open','amber',DB.monhoc.length,'Môn học')}
      ${statCard('fa-building-columns','purple',DB.khoa.length,'Khoa')}
    `;
    renderBarChart();
    renderPieChart();
  } else {
    const sv = getSV(currentUser.MaSV);
    const dks = DB.dangkyhoc.filter(d => d.MaSV?.trim() === currentUser.MaSV?.trim());
    const completed = dks.filter(d => d.TrangThai==='Hoàn thành');
    const totalTC = completed.reduce((s,d)=>{ const lhp=getLHP(d.MaLHP); const mh=getMH(lhp.MaMH); return s+(mh.SoTinChi||0); },0);
    const diems = completed.map(d=>calcDiem(d)).filter(v=>v!==null);
    const gpa = diems.length ? (diems.reduce((a,b)=>a+b,0)/diems.length).toFixed(2) : '—';
    sg.innerHTML = `
      ${statCard('fa-book','blue',dks.length,'Môn đã đăng ký')}
      ${statCard('fa-check-circle','green',completed.length,'Môn hoàn thành')}
      ${statCard('fa-layer-group','amber',totalTC,'Tín chỉ tích lũy')}
      ${statCard('fa-star','purple',gpa,'GPA trung bình')}
    `;
    document.getElementById('barChart').innerHTML='';
    document.getElementById('pieChart').innerHTML='';
  }
}

function statCard(icon,cls,val,label) {
  return `<div class="stat-card">
    <div class="stat-icon ${cls}"><i class="fas ${icon}"></i></div>
    <div><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>
  </div>`;
}

function renderBarChart() {
  const data = DB.khoa.map(k => ({
    label: k.TenKhoa.split(' ').slice(0,3).join(' '),
    count: DB.sinhvien.filter(s => {
      const lop = getLop(s.MaLop); const nganh = getNganh(lop.MaNganh);
      return nganh.MaKhoa?.trim() === k.MaKhoa?.trim();
    }).length
  }));
  const max = Math.max(...data.map(d=>d.count),1);
  document.getElementById('barChart').innerHTML = data.map(d => `
    <div class="bar-item">
      <div class="bar-label"><span>${d.label}</span><span>${d.count}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(d.count/max*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderPieChart() {
  const groups = { 'Đang học':0, 'Bảo lưu':0, 'Tốt nghiệp':0, 'Thôi học':0 };
  DB.sinhvien.forEach(s => groups[s.TrangThai] = (groups[s.TrangThai]||0)+1);
  const colors = ['#1a56db','#f59e0b','#059669','#dc2626'];
  const total = Object.values(groups).reduce((a,b)=>a+b,0)||1;
  const keys = Object.keys(groups);
  const el = document.getElementById('pieChart');
  let stops = [], cumPct = 0;
  const pcts = keys.map((k,i) => ({ k, p:(groups[k]/total*100), c:colors[i] }));
  pcts.forEach(({p,c}) => { stops.push(`${c} ${cumPct.toFixed(1)}% ${(cumPct+p).toFixed(1)}%`); cumPct += p; });
  el.innerHTML = `
    <div style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${stops.join(',')});margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,.1)"></div>
    <div class="pie-legend">${pcts.map(({k,p,c})=>`
      <div class="pie-legend-item"><div class="pie-dot" style="background:${c}"></div>${k} (${p.toFixed(0)}%)</div>`).join('')}
    </div>`;
}

// ══════════════════════════════════════════
// SINH VIÊN
// ══════════════════════════════════════════
function populateSVFilters() {
  document.getElementById('svFilterLop').innerHTML =
    '<option value="">Tất cả lớp</option>' +
    DB.lop.map(l=>`<option value="${l.MaLop}">${l.TenLop}</option>`).join('');
}

function getFilteredSV() {
  const q = document.getElementById('svSearch').value.toLowerCase();
  const fl = document.getElementById('svFilterLop').value;
  const ft = document.getElementById('svFilterTrangThai').value;
  return DB.sinhvien.filter(s =>
    (!q || s.MaSV.toLowerCase().includes(q) || s.HoTen.toLowerCase().includes(q) || (s.Email||'').toLowerCase().includes(q)) &&
    (!fl || s.MaLop?.trim()===fl) && (!ft || s.TrangThai===ft)
  );
}

function renderSinhVienTable() {
  const filtered = getFilteredSV();
  const totalPages = Math.ceil(filtered.length/SV_PER_PAGE)||1;
  if (svPage>totalPages) svPage=1;
  const paged = filtered.slice((svPage-1)*SV_PER_PAGE, svPage*SV_PER_PAGE);
  const tbody = document.getElementById('svBody');
  if (!paged.length) {
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state"><i class="fas fa-search"></i><p>Không tìm thấy sinh viên</p></div></td></tr>`;
  } else {
    tbody.innerHTML = paged.map(sv => {
      const lop = getLop(sv.MaLop);
      return `<tr>
        <td class="text-mono">${sv.MaSV}</td>
        <td><b>${sv.HoTen}</b></td>
        <td>${fmtDate(sv.NgaySinh)}</td>
        <td>${sv.GioiTinh}</td>
        <td style="font-size:12px">${sv.Email}</td>
        <td>${lop.TenLop||sv.MaLop}</td>
        <td>${trangThaiBadge(sv.TrangThai)}</td>
        <td><div class="action-btns">
          <button class="btn-edit btn-sm" onclick="editSinhVien('${sv.MaSV}')"><i class="fas fa-pen"></i></button>
          <button class="btn-del btn-sm" onclick="deleteSV('${sv.MaSV}')"><i class="fas fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }
  let phtml = '';
  for (let i=1;i<=totalPages;i++) phtml+=`<button class="page-btn${i===svPage?' active':''}" onclick="svPage=${i};renderSinhVienTable()">${i}</button>`;
  document.getElementById('svPagination').innerHTML = phtml;
}

function trangThaiBadge(ts) {
  const map = { 'Đang học':'badge-dang','Bảo lưu':'badge-baoluu','Tốt nghiệp':'badge-totnghiep','Thôi học':'badge-thoihoc','Hoàn thành':'badge-hoanhthanh','Rút môn':'badge-rutmon' };
  return `<span class="badge ${map[ts]||''}">${ts}</span>`;
}

function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ── SV CRUD ──
function openSVModal(sv=null) {
  const lops = DB.lop.map(l=>`<option value="${l.MaLop}"${sv&&sv.MaLop?.trim()===l.MaLop?' selected':''}>${l.TenLop}</option>`).join('');
  document.getElementById('sv_MaLop').innerHTML = lops;
  if (sv) {
    document.getElementById('svModalTitle').textContent='Chỉnh sửa Sinh viên';
    document.getElementById('svEditId').value=sv.MaSV;
    document.getElementById('sv_MaSV').value=sv.MaSV; document.getElementById('sv_MaSV').disabled=true;
    document.getElementById('sv_HoTen').value=sv.HoTen;
    document.getElementById('sv_NgaySinh').value=sv.NgaySinh;
    document.getElementById('sv_GioiTinh').value=sv.GioiTinh;
    document.getElementById('sv_Email').value=sv.Email;
    document.getElementById('sv_SDT').value=sv.SoDienThoai||'';
    document.getElementById('sv_MaLop').value=sv.MaLop?.trim();
    document.getElementById('sv_TrangThai').value=sv.TrangThai;
    document.getElementById('sv_DiaChi').value=sv.DiaChi||'';
  } else {
    document.getElementById('svModalTitle').textContent='Thêm Sinh viên';
    document.getElementById('svEditId').value='';
    ['sv_MaSV','sv_HoTen','sv_NgaySinh','sv_Email','sv_SDT','sv_DiaChi'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('sv_MaSV').disabled=false;
    document.getElementById('sv_GioiTinh').value='Nam';
    document.getElementById('sv_TrangThai').value='Đang học';
  }
  openModal('svModal');
}

function editSinhVien(id) { openSVModal(getSV(id)); }

async function saveSinhVien() {
  const editId = document.getElementById('svEditId').value;
  const data = {
    MaSV:        editId || document.getElementById('sv_MaSV').value.trim(),
    HoTen:       document.getElementById('sv_HoTen').value.trim(),
    NgaySinh:    document.getElementById('sv_NgaySinh').value,
    GioiTinh:    document.getElementById('sv_GioiTinh').value,
    Email:       document.getElementById('sv_Email').value.trim(),
    SoDienThoai: document.getElementById('sv_SDT').value.trim(),
    MaLop:       document.getElementById('sv_MaLop').value,
    TrangThai:   document.getElementById('sv_TrangThai').value,
    DiaChi:      document.getElementById('sv_DiaChi').value.trim()
  };
  if (!data.MaSV||!data.HoTen||!data.NgaySinh||!data.Email||!data.MaLop) {
    toast('Vui lòng điền đầy đủ các trường bắt buộc', 'error'); return;
  }
  try {
    if (editId) {
      await apiPut(`/api/sinhvien/${editId}`, data);
      const idx = DB.sinhvien.findIndex(s=>s.MaSV?.trim()===editId);
      if (idx>=0) DB.sinhvien[idx] = { ...DB.sinhvien[idx], ...data };
      toast('Cập nhật thành công!', 'success');
    } else {
      await apiPost('/api/sinhvien', data);
      DB.sinhvien.push(data);
      toast('Thêm sinh viên thành công!', 'success');
    }
    closeAllModals(); renderSinhVienTable();
  } catch(err) { toast('Lỗi: ' + err.message, 'error'); }
}

async function deleteSV(id) {
  confirm2(`Xóa sinh viên <b>${getSV(id)?.HoTen}</b>?`, async () => {
    try {
      await apiDelete(`/api/sinhvien/${id}`);
      DB.sinhvien = DB.sinhvien.filter(s=>s.MaSV?.trim()!==id);
      DB.dangkyhoc = DB.dangkyhoc.filter(d=>d.MaSV?.trim()!==id);
      renderSinhVienTable(); toast('Đã xóa sinh viên', 'info');
    } catch(err) { toast('Lỗi: ' + err.message, 'error'); }
  });
}

// ══════════════════════════════════════════
// GIẢNG VIÊN
// ══════════════════════════════════════════
function renderGVTable() {
  const q = document.getElementById('gvSearch').value.toLowerCase();
  const filtered = DB.giangvien.filter(g => !q || g.MaGV.toLowerCase().includes(q) || g.HoTen.toLowerCase().includes(q));
  document.getElementById('gvBody').innerHTML = filtered.map(gv => {
    const k = getKhoa(gv.MaKhoa);
    return `<tr>
      <td class="text-mono">${gv.MaGV}</td>
      <td><b>${gv.HoTen}</b></td>
      <td><span class="badge badge-dang">${gv.HocVi}</span></td>
      <td>${gv.ChuyenNganh}</td>
      <td style="font-size:12px">${gv.Email}</td>
      <td>${k.TenKhoa||gv.MaKhoa}</td>
      <td><div class="action-btns">
        <button class="btn-edit btn-sm" onclick="editGV('${gv.MaGV}')"><i class="fas fa-pen"></i></button>
        <button class="btn-del btn-sm" onclick="deleteGV('${gv.MaGV}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-search"></i><p>Không tìm thấy</p></div></td></tr>';
}

function editGV(id) {
  const gv = DB.giangvien.find(g=>g.MaGV?.trim()===id);
  document.getElementById('gvModalTitle').textContent='Chỉnh sửa Giảng viên';
  document.getElementById('gvEditId').value=id;
  document.getElementById('gv_MaGV').value=id; document.getElementById('gv_MaGV').disabled=true;
  document.getElementById('gv_HoTen').value=gv.HoTen; document.getElementById('gv_NgaySinh').value=gv.NgaySinh;
  document.getElementById('gv_GioiTinh').value=gv.GioiTinh; document.getElementById('gv_HocVi').value=gv.HocVi;
  document.getElementById('gv_ChuyenNganh').value=gv.ChuyenNganh; document.getElementById('gv_Email').value=gv.Email;
  document.getElementById('gv_SDT').value=gv.SoDienThoai||'';
  document.getElementById('gv_MaKhoa').innerHTML=DB.khoa.map(k=>`<option value="${k.MaKhoa}"${k.MaKhoa?.trim()===gv.MaKhoa?.trim()?' selected':''}>${k.TenKhoa}</option>`).join('');
  openModal('gvModal');
}

function openModal_gv_new() {
  document.getElementById('gvModalTitle').textContent='Thêm Giảng viên';
  document.getElementById('gvEditId').value='';
  ['gv_MaGV','gv_HoTen','gv_NgaySinh','gv_Email','gv_SDT','gv_ChuyenNganh'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('gv_MaGV').disabled=false;
  document.getElementById('gv_MaKhoa').innerHTML=DB.khoa.map(k=>`<option value="${k.MaKhoa}">${k.TenKhoa}</option>`).join('');
}

async function saveGiangVien() {
  const editId=document.getElementById('gvEditId').value;
  const data={
    MaGV:        document.getElementById('gv_MaGV').value.trim()||editId,
    HoTen:       document.getElementById('gv_HoTen').value.trim(),
    NgaySinh:    document.getElementById('gv_NgaySinh').value,
    GioiTinh:    document.getElementById('gv_GioiTinh').value,
    HocVi:       document.getElementById('gv_HocVi').value,
    ChuyenNganh: document.getElementById('gv_ChuyenNganh').value.trim(),
    Email:       document.getElementById('gv_Email').value.trim(),
    SoDienThoai: document.getElementById('gv_SDT').value.trim(),
    MaKhoa:      document.getElementById('gv_MaKhoa').value
  };
  if (!data.MaGV||!data.HoTen||!data.Email) { toast('Điền đầy đủ thông tin','error'); return; }
  try {
    if (editId) {
      await apiPut(`/api/giangvien/${editId}`, data);
      const idx=DB.giangvien.findIndex(g=>g.MaGV?.trim()===editId);
      if(idx>=0) DB.giangvien[idx]={...DB.giangvien[idx],...data};
    } else {
      await apiPost('/api/giangvien', data);
      DB.giangvien.push(data);
    }
    closeAllModals(); renderGVTable(); toast('Lưu thành công!','success');
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

async function deleteGV(id) {
  confirm2(`Xóa giảng viên <b>${DB.giangvien.find(g=>g.MaGV?.trim()===id)?.HoTen}</b>?`, async () => {
    try {
      await apiDelete(`/api/giangvien/${id}`);
      DB.giangvien=DB.giangvien.filter(g=>g.MaGV?.trim()!==id);
      renderGVTable(); toast('Đã xóa','info');
    } catch(err) { toast('Lỗi: '+err.message,'error'); }
  });
}

// ══════════════════════════════════════════
// MÔN HỌC
// ══════════════════════════════════════════
function renderMHTable() {
  const q=document.getElementById('mhSearch').value.toLowerCase();
  const filtered=DB.monhoc.filter(m=>!q||m.MaMH.toLowerCase().includes(q)||m.TenMH.toLowerCase().includes(q));
  document.getElementById('mhBody').innerHTML=filtered.map(m=>`<tr>
    <td class="text-mono">${m.MaMH}</td>
    <td><b>${m.TenMH}</b></td>
    <td style="text-align:center">${m.SoTinChi}</td>
    <td><span class="badge ${m.LoaiMon==='Bắt buộc'?'badge-dang':m.LoaiMon==='Tự chọn'?'badge-baoluu':'badge-totnghiep'}">${m.LoaiMon}</span></td>
    <td style="font-size:12px;color:var(--text-muted)">${m.MoTa||'—'}</td>
    <td><div class="action-btns">
      <button class="btn-edit btn-sm" onclick="editMH('${m.MaMH}')"><i class="fas fa-pen"></i></button>
      <button class="btn-del btn-sm" onclick="deleteMH('${m.MaMH}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function editMH(id) {
  const m=DB.monhoc.find(x=>x.MaMH?.trim()===id);
  document.getElementById('mhModalTitle').textContent='Chỉnh sửa Môn học';
  document.getElementById('mhEditId').value=id;
  document.getElementById('mh_MaMH').value=id; document.getElementById('mh_MaMH').disabled=true;
  document.getElementById('mh_TenMH').value=m.TenMH; document.getElementById('mh_SoTinChi').value=m.SoTinChi;
  document.getElementById('mh_LoaiMon').value=m.LoaiMon; document.getElementById('mh_MoTa').value=m.MoTa||'';
  openModal('mhModal');
}

async function saveMonHoc() {
  const editId=document.getElementById('mhEditId').value;
  const data={
    MaMH:     document.getElementById('mh_MaMH').value.trim()||editId,
    TenMH:    document.getElementById('mh_TenMH').value.trim(),
    SoTinChi: parseInt(document.getElementById('mh_SoTinChi').value),
    LoaiMon:  document.getElementById('mh_LoaiMon').value,
    MoTa:     document.getElementById('mh_MoTa').value.trim()
  };
  if(!data.MaMH||!data.TenMH||isNaN(data.SoTinChi)){toast('Điền đầy đủ thông tin','error');return;}
  try {
    if(editId){
      await apiPut(`/api/monhoc/${editId}`, data);
      const idx=DB.monhoc.findIndex(m=>m.MaMH?.trim()===editId);
      if(idx>=0) DB.monhoc[idx]={...DB.monhoc[idx],...data};
    } else {
      await apiPost('/api/monhoc', data);
      DB.monhoc.push(data);
    }
    closeAllModals(); renderMHTable(); toast('Lưu thành công!','success');
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

async function deleteMH(id) {
  confirm2(`Xóa môn học <b>${DB.monhoc.find(m=>m.MaMH?.trim()===id)?.TenMH}</b>?`, async () => {
    try {
      await apiDelete(`/api/monhoc/${id}`);
      DB.monhoc=DB.monhoc.filter(m=>m.MaMH?.trim()!==id);
      renderMHTable(); toast('Đã xóa','info');
    } catch(err) { toast('Lỗi: '+err.message,'error'); }
  });
}

// ══════════════════════════════════════════
// LỚP
// ══════════════════════════════════════════
function renderLopTable() {
  const q=document.getElementById('lopSearch').value.toLowerCase();
  const filtered=DB.lop.filter(l=>!q||l.MaLop.toLowerCase().includes(q)||l.TenLop.toLowerCase().includes(q));
  document.getElementById('lopBody').innerHTML=filtered.map(l=>{
    const n=getNganh(l.MaNganh);
    return `<tr>
      <td class="text-mono">${l.MaLop}</td><td><b>${l.TenLop}</b></td>
      <td>${n.TenNganh||l.MaNganh}</td><td>${l.NamNhapHoc}</td><td>${fmtDate(l.NgayNhapHoc)}</td>
      <td><div class="action-btns">
        <button class="btn-edit btn-sm" onclick="editLop('${l.MaLop}')"><i class="fas fa-pen"></i></button>
        <button class="btn-del btn-sm" onclick="deleteLop('${l.MaLop}')"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function editLop(id) {
  const l=DB.lop.find(x=>x.MaLop?.trim()===id);
  document.getElementById('lopModalTitle').textContent='Chỉnh sửa Lớp';
  document.getElementById('lopEditId').value=id;
  document.getElementById('lop_MaLop').value=id; document.getElementById('lop_MaLop').disabled=true;
  document.getElementById('lop_TenLop').value=l.TenLop; document.getElementById('lop_NamNhapHoc').value=l.NamNhapHoc;
  document.getElementById('lop_NgayNhapHoc').value=l.NgayNhapHoc;
  document.getElementById('lop_MaNganh').innerHTML=DB.nganh.map(n=>`<option value="${n.MaNganh}"${n.MaNganh?.trim()===l.MaNganh?.trim()?' selected':''}>${n.TenNganh}</option>`).join('');
  openModal('lopModal');
}

async function saveLop() {
  const editId=document.getElementById('lopEditId').value;
  const data={
    MaLop:      document.getElementById('lop_MaLop').value.trim()||editId,
    TenLop:     document.getElementById('lop_TenLop').value.trim(),
    MaNganh:    document.getElementById('lop_MaNganh').value,
    NamNhapHoc: parseInt(document.getElementById('lop_NamNhapHoc').value),
    NgayNhapHoc:document.getElementById('lop_NgayNhapHoc').value
  };
  if(!data.MaLop||!data.TenLop){toast('Điền đầy đủ','error');return;}
  try {
    if(editId){
      await apiPut(`/api/lop/${editId}`, data);
      const idx=DB.lop.findIndex(l=>l.MaLop?.trim()===editId);
      if(idx>=0) DB.lop[idx]={...DB.lop[idx],...data};
    } else {
      await apiPost('/api/lop', data);
      DB.lop.push(data);
    }
    closeAllModals(); renderLopTable(); toast('Lưu thành công!','success');
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

async function deleteLop(id) {
  confirm2(`Xóa lớp <b>${DB.lop.find(l=>l.MaLop?.trim()===id)?.TenLop}</b>?`, async () => {
    try {
      await apiDelete(`/api/lop/${id}`);
      DB.lop=DB.lop.filter(l=>l.MaLop?.trim()!==id);
      renderLopTable(); toast('Đã xóa','info');
    } catch(err) { toast('Lỗi: '+err.message,'error'); }
  });
}

// ══════════════════════════════════════════
// KHOA
// ══════════════════════════════════════════
function renderKhoaTable() {
  const q=document.getElementById('khoaSearch').value.toLowerCase();
  const filtered=DB.khoa.filter(k=>!q||k.MaKhoa.toLowerCase().includes(q)||k.TenKhoa.toLowerCase().includes(q));
  document.getElementById('khoaBody').innerHTML=filtered.map(k=>`<tr>
    <td class="text-mono">${k.MaKhoa}</td><td><b>${k.TenKhoa}</b></td>
    <td style="font-size:12px">${k.Email||'—'}</td><td>${k.SoDienThoai||'—'}</td><td>${fmtDate(k.NgayThanhLap)}</td>
    <td><div class="action-btns">
      <button class="btn-edit btn-sm" onclick="editKhoa('${k.MaKhoa}')"><i class="fas fa-pen"></i></button>
      <button class="btn-del btn-sm" onclick="deleteKhoa('${k.MaKhoa}')"><i class="fas fa-trash"></i></button>
    </div></td>
  </tr>`).join('');
}

function editKhoa(id) {
  const k=DB.khoa.find(x=>x.MaKhoa?.trim()===id);
  document.getElementById('khoaModalTitle').textContent='Chỉnh sửa Khoa';
  document.getElementById('khoaEditId').value=id;
  document.getElementById('khoa_MaKhoa').value=id; document.getElementById('khoa_MaKhoa').disabled=true;
  document.getElementById('khoa_TenKhoa').value=k.TenKhoa; document.getElementById('khoa_Email').value=k.Email||'';
  document.getElementById('khoa_SDT').value=k.SoDienThoai||''; document.getElementById('khoa_DiaChi').value=k.DiaChi||'';
  document.getElementById('khoa_NgayTL').value=k.NgayThanhLap;
  openModal('khoaModal');
}

async function saveKhoa() {
  const editId=document.getElementById('khoaEditId').value;
  const data={
    MaKhoa:      document.getElementById('khoa_MaKhoa').value.trim()||editId,
    TenKhoa:     document.getElementById('khoa_TenKhoa').value.trim(),
    Email:        document.getElementById('khoa_Email').value.trim(),
    SoDienThoai: document.getElementById('khoa_SDT').value.trim(),
    DiaChi:       document.getElementById('khoa_DiaChi').value.trim(),
    NgayThanhLap: document.getElementById('khoa_NgayTL').value
  };
  if(!data.MaKhoa||!data.TenKhoa){toast('Điền đầy đủ','error');return;}
  try {
    if(editId){
      await apiPut(`/api/khoa/${editId}`, data);
      const idx=DB.khoa.findIndex(k=>k.MaKhoa?.trim()===editId);
      if(idx>=0) DB.khoa[idx]={...DB.khoa[idx],...data};
    } else {
      await apiPost('/api/khoa', data);
      DB.khoa.push(data);
    }
    closeAllModals(); renderKhoaTable(); toast('Lưu thành công!','success');
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

async function deleteKhoa(id) {
  confirm2(`Xóa khoa <b>${DB.khoa.find(k=>k.MaKhoa?.trim()===id)?.TenKhoa}</b>?`, async () => {
    try {
      await apiDelete(`/api/khoa/${id}`);
      DB.khoa=DB.khoa.filter(k=>k.MaKhoa?.trim()!==id);
      renderKhoaTable(); toast('Đã xóa','info');
    } catch(err) { toast('Lỗi: '+err.message,'error'); }
  });
}

// ══════════════════════════════════════════
// ADMIN ĐIỂM
// ══════════════════════════════════════════
function renderDiemAdmin() {
  const sel=document.getElementById('diemFilterSV');
  const q=document.getElementById('diemSearch').value.toLowerCase();
  const svList=DB.sinhvien.filter(s=>!q||s.MaSV.toLowerCase().includes(q)||s.HoTen.toLowerCase().includes(q));
  sel.innerHTML='<option value="">-- Chọn sinh viên --</option>'+svList.map(s=>`<option value="${s.MaSV}">${s.HoTen} (${s.MaSV})</option>`).join('');
  renderDiemDetail();
}

function renderDiemDetail() {
  const maSV=document.getElementById('diemFilterSV').value;
  const el=document.getElementById('diemDetail');
  if(!maSV){el.innerHTML='<div class="empty-state"><i class="fas fa-user-graduate"></i><p>Chọn sinh viên để xem điểm</p></div>';return;}
  const sv=getSV(maSV);
  if(!sv){el.innerHTML='<div class="empty-state"><i class="fas fa-user-graduate"></i><p>Không tìm thấy sinh viên</p></div>';return;}
  const dks=DB.dangkyhoc.filter(d=>d.MaSV?.trim()===maSV?.trim());
  if(!dks.length){el.innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>Sinh viên chưa đăng ký môn học nào</p></div>';return;}
  const rows=dks.map(dk=>{
    const lhp=getLHP(dk.MaLHP); const mh=getMH(lhp.MaMH); const hk=getHK(lhp.MaHK);
    const dtk=calcDiem(dk);
    const dtkClass=dtk===null?'diem-na':dtk>=8?'diem-pass':dtk>=5?'diem-avg':'diem-fail';
    return `<tr>
      <td class="text-mono">${dk.MaLHP}</td>
      <td><b>${mh.TenMH||dk.MaLHP}</b></td>
      <td style="text-align:center">${mh.SoTinChi||'—'}</td>
      <td>${hk.TenHK||lhp.MaHK||'—'}</td>
      <td class="score-col"><span class="diem-val">${dk.DiemCC??'—'}</span></td>
      <td class="score-col"><span class="diem-val">${dk.DiemGiuaKy??'—'}</span></td>
      <td class="score-col"><span class="diem-val">${dk.DiemCuoiKy??'—'}</span></td>
      <td class="score-col"><span class="diem-val ${dtkClass}">${dtk??'—'}</span></td>
      <td>${trangThaiBadge(dk.TrangThai)}</td>
      <td><button class="btn-edit btn-sm" onclick="openEditDiem(${dk.MaDK})"><i class="fas fa-pen"></i></button></td>
    </tr>`;
  }).join('');
  const dksDone=dks.filter(d=>d.TrangThai==='Hoàn thành');
  const diems=dksDone.map(d=>calcDiem(d)).filter(v=>v!==null);
  const gpa=diems.length?(diems.reduce((a,b)=>a+b,0)/diems.length).toFixed(2):'—';
  el.innerHTML=`<div class="score-card">
    <div class="score-header">
      <h4><i class="fas fa-user"></i> ${sv.HoTen} — ${sv.MaSV}</h4>
      <span class="gpa-badge">GPA: ${gpa}</span>
    </div>
    <div class="table-wrap" style="border-radius:0;border:none;box-shadow:none">
      <table class="data-table"><thead><tr>
        <th>Mã LHP</th><th>Môn học</th><th>TC</th><th>Học kỳ</th>
        <th class="score-col">Chuyên cần</th><th class="score-col">Giữa kỳ</th>
        <th class="score-col">Cuối kỳ</th><th class="score-col">Tổng kết</th>
        <th>Trạng thái</th><th>Sửa</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>
  </div>`;
}

function openEditDiem(maDK) {
  const dk = DB.dangkyhoc.find(d=>d.MaDK===maDK);
  if(!dk) return;
  const lhp=getLHP(dk.MaLHP); const mh=getMH(lhp.MaMH);
  const modal = document.createElement('div');
  modal.className='modal active'; modal.id='diemEditModal';
  modal.innerHTML=`
    <div class="modal-header"><h3><i class="fas fa-star"></i> Sửa điểm: ${mh.TenMH||dk.MaLHP}</h3>
      <button onclick="closeAllModals()" class="modal-close"><i class="fas fa-times"></i></button></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label>Điểm chuyên cần (10%)</label>
          <input type="number" id="e_cc" min="0" max="10" step="0.5" value="${dk.DiemCC??''}"></div>
        <div class="form-group"><label>Điểm giữa kỳ (30%)</label>
          <input type="number" id="e_gk" min="0" max="10" step="0.5" value="${dk.DiemGiuaKy??''}"></div>
        <div class="form-group"><label>Điểm cuối kỳ (60%)</label>
          <input type="number" id="e_ck" min="0" max="10" step="0.5" value="${dk.DiemCuoiKy??''}"></div>
        <div class="form-group"><label>Trạng thái</label>
          <select id="e_tt">
            ${['Đang học','Hoàn thành','Rút môn'].map(v=>`<option${v===dk.TrangThai?' selected':''}>${v}</option>`).join('')}
          </select></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeAllModals()">Hủy</button>
      <button class="btn btn-primary" onclick="saveEditDiem(${maDK})"><i class="fas fa-save"></i> Lưu điểm</button>
    </div>`;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.appendChild(modal);
}

async function saveEditDiem(maDK) {
  const body = {
    DiemCC:     parseFloat(document.getElementById('e_cc').value)||null,
    DiemGiuaKy: parseFloat(document.getElementById('e_gk').value)||null,
    DiemCuoiKy: parseFloat(document.getElementById('e_ck').value)||null,
    TrangThai:  document.getElementById('e_tt').value
  };
  try {
    await apiPut(`/api/dangkyhoc/${maDK}/diem`, body);
    const idx = DB.dangkyhoc.findIndex(d=>d.MaDK===maDK);
    if(idx>=0) DB.dangkyhoc[idx]={...DB.dangkyhoc[idx],...body};
    closeAllModals(); renderDiemDetail(); toast('Lưu điểm thành công!','success');
  } catch(err) { toast('Lỗi: '+err.message,'error'); }
}

// ══════════════════════════════════════════
// SINH VIÊN - HỒ SƠ CÁ NHÂN / ĐIỂM / LỚP
// ══════════════════════════════════════════
function renderMyInfo() {
  const sv=getSV(currentUser.MaSV);
  if(!sv){document.getElementById('myInfoContent').innerHTML='<div class="empty-state"><i class="fas fa-user"></i><p>Không tìm thấy thông tin</p></div>';return;}
  const lop=getLop(sv.MaLop); const nganh=getNganh(lop.MaNganh); const khoa=getKhoa(nganh.MaKhoa);
  document.getElementById('myInfoContent').innerHTML=`
    <div class="profile-card">
      <div class="profile-avatar">${sv.HoTen.split(' ').pop()[0].toUpperCase()}</div>
      <div class="profile-info">
        <h2>${sv.HoTen}</h2><p>${sv.MaSV} · ${trangThaiBadge(sv.TrangThai)}</p>
        <div class="info-grid">
          <div class="info-item"><label>Ngày sinh</label><span>${fmtDate(sv.NgaySinh)}</span></div>
          <div class="info-item"><label>Giới tính</label><span>${sv.GioiTinh}</span></div>
          <div class="info-item"><label>Email</label><span>${sv.Email}</span></div>
          <div class="info-item"><label>Điện thoại</label><span>${sv.SoDienThoai||'—'}</span></div>
          <div class="info-item"><label>Lớp</label><span>${lop.TenLop||sv.MaLop}</span></div>
          <div class="info-item"><label>Ngành</label><span>${nganh.TenNganh||'—'}</span></div>
          <div class="info-item"><label>Khoa</label><span>${khoa.TenKhoa||'—'}</span></div>
          <div class="info-item"><label>Địa chỉ</label><span>${sv.DiaChi||'—'}</span></div>
        </div>
      </div>
    </div>`;
}

function renderMyDiem() {
  const dks=DB.dangkyhoc.filter(d=>d.MaSV?.trim()===currentUser.MaSV?.trim());
  if(!dks.length){document.getElementById('myDiemContent').innerHTML='<div class="empty-state"><i class="fas fa-book-open"></i><p>Chưa có điểm nào</p></div>';return;}
  const rows=dks.map(dk=>{
    const lhp=getLHP(dk.MaLHP); const mh=getMH(lhp.MaMH); const hk=getHK(lhp.MaHK);
    const dtk=calcDiem(dk);
    const dtkClass=dtk===null?'diem-na':dtk>=8?'diem-pass':dtk>=5?'diem-avg':'diem-fail';
    return `<tr>
      <td><b>${mh.TenMH||dk.MaLHP}</b></td>
      <td style="text-align:center">${mh.SoTinChi||'—'}</td>
      <td>${hk.TenHK||lhp.MaHK||'—'}</td>
      <td class="score-col">${dk.DiemCC??'—'}</td>
      <td class="score-col">${dk.DiemGiuaKy??'—'}</td>
      <td class="score-col">${dk.DiemCuoiKy??'—'}</td>
      <td class="score-col"><b class="diem-val ${dtkClass}">${dtk??'—'}</b></td>
      <td>${trangThaiBadge(dk.TrangThai)}</td>
    </tr>`;
  }).join('');
  const done=dks.filter(d=>d.TrangThai==='Hoàn thành');
  const diems=done.map(d=>calcDiem(d)).filter(v=>v!==null);
  const gpa=diems.length?(diems.reduce((a,b)=>a+b,0)/diems.length).toFixed(2):'—';
  const tc=done.reduce((s,d)=>{const l=getLHP(d.MaLHP);const m=getMH(l.MaMH);return s+(m.SoTinChi||0);},0);
  document.getElementById('myDiemContent').innerHTML=`
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      ${statCard('fa-star','purple',gpa,'GPA trung bình')}
      ${statCard('fa-layer-group','blue',tc,'Tín chỉ tích lũy')}
      ${statCard('fa-check','green',done.length,'Môn hoàn thành')}
    </div>
    <div class="score-card">
      <div class="score-header"><h4><i class="fas fa-table-list"></i> Bảng điểm chi tiết</h4></div>
      <div class="table-wrap" style="border-radius:0;border:none;box-shadow:none">
        <table class="data-table"><thead><tr>
          <th>Môn học</th><th>TC</th><th>Học kỳ</th>
          <th class="score-col">CC</th><th class="score-col">GK</th><th class="score-col">CK</th>
          <th class="score-col">Tổng kết</th><th>Trạng thái</th>
        </tr></thead><tbody>${rows}</tbody></table>
      </div>
    </div>`;
}

function renderMyLop() {
  const dks=DB.dangkyhoc.filter(d=>d.MaSV?.trim()===currentUser.MaSV?.trim());
  if(!dks.length){document.getElementById('myLopContent').innerHTML='<div class="empty-state"><i class="fas fa-list-check"></i><p>Chưa đăng ký môn học nào</p></div>';return;}
  const rows=dks.map(dk=>{
    const lhp=getLHP(dk.MaLHP); const mh=getMH(lhp.MaMH); const gv=getGV(lhp.MaGV); const hk=getHK(lhp.MaHK);
    return `<tr>
      <td class="text-mono">${dk.MaLHP}</td>
      <td><b>${mh.TenMH||dk.MaLHP}</b></td>
      <td style="text-align:center">${mh.SoTinChi||'—'}</td>
      <td>${gv.HoTen||lhp.MaGV}</td>
      <td>${hk.TenHK||lhp.MaHK||'—'}</td>
      <td>${lhp.PhongHoc||'—'}</td>
      <td style="font-size:12px">${lhp.LichHoc||'—'}</td>
      <td>${trangThaiBadge(dk.TrangThai)}</td>
    </tr>`;
  }).join('');
  document.getElementById('myLopContent').innerHTML=`
    <div class="table-wrap">
      <table class="data-table"><thead><tr>
        <th>Mã LHP</th><th>Môn học</th><th>TC</th><th>Giảng viên</th><th>Học kỳ</th><th>Phòng</th><th>Lịch học</th><th>Trạng thái</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>`;
}

// ══════════════════════════════════════════
// IMPORT SINH VIÊN
// ══════════════════════════════════════════
function handleExcelDrop(e){ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) processExcelFile(f); }
function handleExcelFile(e){ const f=e.target.files[0]; if(f) processExcelFile(f); }
function handleJsonDrop(e){ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) processJsonFile(f); }
function handleJsonFile(e){ const f=e.target.files[0]; if(f) processJsonFile(f); }

function processExcelFile(file){
  const isCSV = file.name.endsWith('.csv');
  if(isCSV){
    const reader=new FileReader();
    reader.onload=e=>importFromCSV(e.target.result);
    reader.readAsText(file,'UTF-8');
    return;
  }
  if(!window.XLSX){toast('Thư viện XLSX chưa tải xong','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      importRows(XLSX.utils.sheet_to_json(ws));
    }catch(err){toast('Lỗi đọc file Excel: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

function importFromCSV(text){
  const lines=text.trim().split('\n');
  const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const rows=lines.slice(1).map(line=>{
    const vals=line.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]||''; });
    return obj;
  });
  importRows(rows);
}

function processJsonFile(file){
  const reader=new FileReader();
  reader.onload=e=>{ try{ importRows(JSON.parse(e.target.result)); }catch(e){ toast('File JSON không hợp lệ','error'); } };
  reader.readAsText(file,'UTF-8');
}

function importJSON(){
  try{ importRows(JSON.parse(document.getElementById('jsonInput').value)); }
  catch(e){ toast('JSON không hợp lệ: '+e.message,'error'); }
}

async function importRows(rows){
  // Validate và chuẩn hóa
  const data = rows.map(row => ({
    MaSV:        (row.MaSV||row.masv||row.MASV||'').toString().trim(),
    HoTen:       (row.HoTen||row.hoten||'').toString().trim(),
    NgaySinh:    (row.NgaySinh||row.ngaysinh||'').toString().trim(),
    GioiTinh:    (row.GioiTinh||row.gioitinh||'Nam').toString().trim(),
    Email:       (row.Email||row.email||'').toString().trim(),
    MaLop:       (row.MaLop||row.malop||'').toString().trim(),
    DiaChi:      (row.DiaChi||'').toString().trim(),
    SoDienThoai: (row.SoDienThoai||row.SDT||'').toString().trim(),
    TrangThai:   (row.TrangThai||'Đang học').toString().trim()
  })).filter(r => r.MaSV && r.HoTen && r.Email);

  if(!data.length){ toast('Không có dữ liệu hợp lệ','error'); return; }

  try {
    const result = await apiPost('/api/sinhvien/import', data);
    // Reload data
    const fresh = await apiGet('/api/all');
    DB.sinhvien = fresh.sinhvien;
    const el = document.getElementById('importResult');
    el.innerHTML = `
      <div class="import-summary">
        <div class="import-stat"><div class="num success-num">${result.ok}</div><div class="lbl">Thành công</div></div>
        <div class="import-stat"><div class="num fail-num">${result.fail}</div><div class="lbl">Thất bại</div></div>
        <div class="import-stat"><div class="num">${result.ok+result.fail}</div><div class="lbl">Tổng cộng</div></div>
      </div>
      ${result.errors?.length?`<div class="card" style="padding:16px"><b>Lỗi:</b><ul style="margin-top:8px;padding-left:20px;font-size:13px;color:var(--red)">${result.errors.map(e=>`<li>${e}</li>`).join('')}</ul></div>`:''}
      <p style="font-size:13px;color:var(--green);margin-top:8px"><i class="fas fa-check"></i> Import hoàn tất. Vào tab <b>Sinh viên</b> để xem.</p>`;
    toast(`Import xong: ${result.ok} thành công, ${result.fail} lỗi`, 'success');
  } catch(err) {
    toast('Lỗi import: '+err.message, 'error');
  }
}

// ══════════════════════════════════════════
// MODAL SYSTEM
// ══════════════════════════════════════════
function openModal(id){
  if(id==='gvModal' && !document.getElementById('gvEditId').value){
    document.getElementById('gv_MaKhoa').innerHTML=DB.khoa.map(k=>`<option value="${k.MaKhoa}">${k.TenKhoa}</option>`).join('');
    document.getElementById('gv_MaGV').disabled=false;
    ['gv_MaGV','gv_HoTen','gv_NgaySinh','gv_Email','gv_SDT','gv_ChuyenNganh'].forEach(i=>document.getElementById(i).value='');
  }
  if(id==='svModal' && !document.getElementById('svEditId').value){
    document.getElementById('sv_MaSV').disabled=false;
    document.getElementById('sv_MaLop').innerHTML=DB.lop.map(l=>`<option value="${l.MaLop}">${l.TenLop}</option>`).join('');
  }
  if(id==='lopModal' && !document.getElementById('lopEditId').value){
    document.getElementById('lop_MaLop').disabled=false;
    document.getElementById('lop_MaNganh').innerHTML=DB.nganh.map(n=>`<option value="${n.MaNganh}">${n.TenNganh}</option>`).join('');
    ['lop_MaLop','lop_TenLop','lop_NamNhapHoc','lop_NgayNhapHoc'].forEach(i=>document.getElementById(i).value='');
  }
  if(id==='khoaModal' && !document.getElementById('khoaEditId').value){
    document.getElementById('khoa_MaKhoa').disabled=false;
    ['khoa_MaKhoa','khoa_TenKhoa','khoa_Email','khoa_SDT','khoa_DiaChi','khoa_NgayTL'].forEach(i=>document.getElementById(i).value='');
  }
  if(id==='mhModal' && !document.getElementById('mhEditId').value){
    document.getElementById('mh_MaMH').disabled=false;
    ['mh_MaMH','mh_TenMH','mh_SoTinChi','mh_MoTa'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('mhEditId').value='';
  }
  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById(id).classList.add('active');
}

function closeAllModals(){
  document.getElementById('modalOverlay').classList.remove('active');
  document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));
  document.querySelectorAll('.modal').forEach(m=>{ if(m.id==='diemEditModal')m.remove(); });
}

function confirm2(msg, cb){
  document.getElementById('confirmMsg').innerHTML=msg;
  document.getElementById('confirmBtn').onclick=()=>{closeAllModals();cb();};
  openModal('confirmModal');
}

// ══════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════
let toastTimer;
function toast(msg, type='info'){
  const el=document.getElementById('toast');
  el.className=`toast ${type}`;
  el.innerHTML=`<i class="fas ${type==='success'?'fa-check-circle':type==='error'?'fa-circle-exclamation':'fa-circle-info'}"></i>${msg}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.add('hidden'),3200);
}

// ══════════════════════════════════════════
// KEYBOARD
// ══════════════════════════════════════════
document.addEventListener('keydown', e => {
  if(e.key==='Escape') closeAllModals();
  if(e.key==='Enter' && document.getElementById('loginScreen').classList.contains('active')) doLogin();
});

// ══════════════════════════════════════════
// INIT — không cần loadDB trước login
// ══════════════════════════════════════════
// (Data được load sau khi đăng nhập thành công)
