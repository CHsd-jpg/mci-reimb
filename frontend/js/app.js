// app.js - MCI报销系统 (纯前端Bitable版)
let user = null;

document.addEventListener('DOMContentLoaded', async () => {
  user = getCurrentUser();
  if (user) { showAuth(); return; }
  showGuest();
  setupGuestNav();
});

function g(id) { return document.getElementById(id); }

// ===== 视图 =====
function showGuest() {
  g('guest-view').style.display = 'block';
  g('auth-view').style.display = 'none';
}
function showAuth() {
  g('guest-view').style.display = 'none';
  g('auth-view').style.display = 'block';
  user = getCurrentUser();
  g('user-avatar').textContent = user.name[0].toUpperCase();
  g('user-name').textContent = user.name;
  g('user-role-badge').textContent = user.role;
  document.querySelectorAll('.hide-l3').forEach(el => el.style.display = hasLevel(1) ? '' : 'none');
  g('nav-monitor').style.display = hasLevel(1) ? '' : 'none';
  loadDashboard();
}

function setupGuestNav() {
  document.querySelectorAll('.nv').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.g;
      document.querySelectorAll('.g-page').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.nv').forEach(l => l.classList.remove('active'));
      const t = g('g-' + page);
      if (t) t.classList.add('active');
      el.classList.add('active');
    });
  });
}

document.querySelectorAll('.sl').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    const d = el.dataset.d;
    document.querySelectorAll('.dash').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sl').forEach(l => l.classList.remove('active'));
    const t = g('d-' + d);
    if (t) t.classList.add('active');
    el.classList.add('active');
    g('sidebar').classList.remove('open');
    switch (d) {
      case 'home': loadDashboard(); break;
      case 'reimb-list': loadReimbList(); break;
      case 'my-reimb': loadMyReimb(); break;
      case 'stats': loadStats(); break;
      case 'accounts': loadAccounts(); break;
      case 'monitor': loadMonitor(); break;
      case 'profile': loadProfile(); break;
    }
  });
});

function toggleSidebar() { g('sidebar').classList.toggle('open'); }

// ===== 登录 =====
function openLogin() { g('login-modal').style.display = 'flex'; g('login-err').style.display = 'none'; }
function closeLogin() { g('login-modal').style.display = 'none'; }
function fillLogin(name) { g('login-form').querySelector('[name="username"]').value = name; }

async function handleLogin(e) {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button');
  btn.disabled = true; btn.textContent = '登录中...';
  g('login-err').style.display = 'none';
  try {
    const userInfo = await API.login(f.username.value);
    user = userInfo;
    closeLogin();
    showAuth();
  } catch (err) {
    g('login-err').textContent = err.message || '登录失败';
    g('login-err').style.display = 'block';
  }
  btn.disabled = false; btn.textContent = '登录';
}

function handleLogout() { logout(); }

// ===== 申请账号 =====
async function submitApply(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await createRec(TABLES.users, {
      名称: f.name.value, 姓名: f.name.value,
      所属权限组: ['员工'], 状态: ['启用'],
    });
    showMsg('apply-msg', '✅ 申请已提交，请联系老板审核', 'ok');
    f.reset();
  } catch (err) { showMsg('apply-msg', '❌ ' + err.message, 'err'); }
}

// ===== 总览 =====
async function loadDashboard() {
  try {
    const r = await getStats();
    const d = r.data || r;
    g('st-total').textContent = '¥' + ((d.totals?.t || 0) / 1).toFixed(2);
    g('st-pending').textContent = (d.byStatus||[]).reduce((s,i) => s + (i.count||0), 0);
    g('st-approved').textContent = (d.byStatus||[]).filter(i => i.status==='已通过').reduce((s,i)=>s+i.count,0);
    g('st-rejected').textContent = (d.byStatus||[]).filter(i => i.status==='已驳回').reduce((s,i)=>s+i.count,0);

    const cats = d.byCategory || [];
    g('activity-feed').innerHTML = cats.length
      ? cats.map(c => `<div style="padding:6px 0;font-size:13px;border-bottom:1px solid var(--b)"><strong>${c.category_main}</strong>：${c.count}笔，¥${(c.total||0).toFixed(2)}</div>`).join('')
      : '<p class="muted">暂无数据</p>';
  } catch (e) { console.error(e); }
}

// ===== 新建报销 =====
const CAT_MAP = {
  '公务': { subs: ['差旅费','办公用品','业务招待费','通讯费','交通费','会议费','培训费','其他公务费用'],
    notes: ['差旅_机票','差旅_酒店','差旅_餐饮补贴','办公_设备','办公_耗材','办公_软件','招待_餐饮','招待_礼品','交通_出租车','通讯_话费'] },
  '私人': { subs: ['医疗费用','教育培训','家庭开支','交通费用','通讯费用','其他私人费用'],
    notes: ['医疗_门诊','医疗_住院','教育_课程','教育_书籍','家庭_水电','家庭_物业','交通_加油','通讯_话费'] },
  '其他': { subs: ['项目经费','活动经费','应急支出','捐赠','其他'],
    notes: ['项目_材料','项目_人工','活动_场地','活动_餐饮','应急_维修','应急_采购'] },
};
function updateSubCats(cat) {
  const sub = document.querySelector('select[name="cat_sub"]');
  const note = document.querySelector('select[name="cat_note"]');
  if (cat && CAT_MAP[cat]) {
    sub.innerHTML = '<option value="">请选择</option>' + CAT_MAP[cat].subs.map(s => `<option value="${s}">${s}</option>`).join('');
    note.innerHTML = '<option value="">无</option>' + CAT_MAP[cat].notes.map(n => `<option value="${n}">${n}</option>`).join('');
  } else { sub.innerHTML = '<option value="">请先选择大类</option>'; note.innerHTML = '<option value="">无</option>'; }
}
function previewReceipt(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    g('receipt-img').src = e.target.result;
    g('receipt-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}
function clearReceipt() { g('receipt-preview').style.display = 'none'; document.querySelector('input[name="receipt"]').value = ''; }

async function submitReimb(e) {
  e.preventDefault();
  const f = e.target, btn = f.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '提交中...';
  try {
    const r = await createReimb({
      category_main: f.cat_main.value, category_sub: f.cat_sub.value,
      category_note: f.cat_note.value, amount: f.amount.value,
      description: f.description.value,
    });
    showMsg('reimb-msg', `✅ 提交成功！单号：${r.reimbursement_no}`, 'ok');
    f.reset();
    setTimeout(() => { g('reimb-msg').style.display = 'none'; }, 3000);
  } catch (err) { showMsg('reimb-msg', '❌ ' + err.message, 'err'); }
  btn.disabled = false; btn.textContent = '提交报销';
}

// ===== 报销列表 =====
let rlPage = 1;
async function loadReimbList() {
  const params = { page: rlPage, limit: 20 };
  if (g('rl-search').value) params.search = g('rl-search').value;
  if (g('rl-status').value) params.status = g('rl-status').value;
  if (g('rl-cat').value) params.category = g('rl-cat').value;
  try {
    const r = await getReimbList(params);
    const tbody = g('rl-tbody');
    if (r.data.length) {
      tbody.innerHTML = r.data.map(i => `
        <tr><td><code>${i.名称||i.报销单号||'-'}</code></td>
          <td>${i.申请人||'-'}</td>
          <td>${Array.isArray(i.报销大类)?i.报销大类[0]:i.报销大类||'-'}/${i.报销细类||'-'}</td>
          <td><strong>¥${(parseFloat(i.报销金额||0)||0).toFixed(2)}</strong></td>
          <td><span class="sb ${i.审批意见==='已通过'?'approved':i.审批意见==='已驳回'?'rejected':'pending'}">${i.审批意见||'待审批'}</span></td>
          <td class="muted">${i.申请日期||i.归档日期||''}</td>
          <td class="action-btns">${i.审批意见==='已通过'?'✅':i.审批意见==='已驳回'?'❌':'⏳'}</td>
        </tr>
      `).join('');
    } else { tbody.innerHTML = '<tr><td colspan="7" class="muted">暂无数据</td></tr>'; }
  } catch (e) { console.error(e); }
}

// ===== 我的报销 =====
async function loadMyReimb() {
  try {
    const r = await getReimbList({ limit: 100 });
    const tbody = g('mr-tbody');
    const mine = r.data.filter(i => i.申请人 === user?.name);
    if (mine.length) {
      tbody.innerHTML = mine.map(i => `
        <tr><td><code>${i.名称||i.报销单号||'-'}</code></td>
          <td>${Array.isArray(i.报销大类)?i.报销大类[0]:i.报销大类||'-'}</td>
          <td>${i.报销细类||'-'}</td>
          <td><small>${Array.isArray(i.备注细分用途)?i.备注细分用途.join(','):i.备注细分用途||'-'}</small></td>
          <td><strong>¥${(parseFloat(i.报销金额||0)||0).toFixed(2)}</strong></td>
          <td><span class="sb ${i.审批意见==='已通过'?'approved':i.审批意见==='已驳回'?'rejected':'pending'}">${i.审批意见||'待审批'}</span></td>
          <td class="muted">${i.申请日期||''}</td>
        </tr>
      `).join('');
    } else { tbody.innerHTML = '<tr><td colspan="7" class="muted">暂无报销记录</td></tr>'; }
  } catch (e) { console.error(e); }
}

// ===== 统计 =====
async function loadStats() {
  try {
    const r = await getStats();
    const d = r.data || r;
    const t = d.totals || {};
    g('st2-total').textContent = '¥' + ((t.t||0)/1).toFixed(2);
    g('st2-count').textContent = t.c||0;
    g('st2-avg').textContent = t.c ? '¥' + ((t.t||0)/t.c).toFixed(2) : '¥0';

    const cats = d.byCategory || [];
    const maxCat = Math.max(...cats.map(c=>c.total||0), 1);
    g('cat-chart').innerHTML = '<div class="stat-chart">' + cats.map(c => `
      <div class="row"><div class="lbl">${c.category_main}</div>
        <div class="bar-wrap"><div class="bar-fill" style="width:${((c.total||0)/maxCat*100).toFixed(1)}%">¥${(c.total||0).toFixed(0)}</div></div>
        <div class="lbl">${c.count}笔</div></div>
    `).join('') + '</div>' || '<p class="muted">暂无数据</p>';
  } catch (e) { console.error(e); }
}

// ===== 账号管理 =====
async function loadAccounts() {
  try {
    const all = await getAccounts();
    const tbody = g('ac-tbody');
    if (all.length) {
      tbody.innerHTML = all.map(a => `
        <tr><td><code>${a.record_id?.substring(0,8)||'-'}</code></td>
          <td>${a.fields.名称||'-'}</td>
          <td>${a.fields.姓名||'-'}</td>
          <td><span class="role-tag">${a.fields.所属权限组||'-'}</span></td>
          <td>${a.fields.部门||'-'}</td>
          <td><span class="sb ${a.fields.状态==='启用'?'approved':'rejected'}">${a.fields.状态||'启用'}</span></td>
          <td class="action-btns">${a.fields.名称!=='YK'?'-':''}</td>
        </tr>
      `).join('');
    } else { tbody.innerHTML = '<tr><td colspan="7" class="muted">暂无账号</td></tr>'; }
  } catch (e) { console.error(e); }
}

// ===== 监控 =====
async function loadMonitor() {
  try {
    const st = await getSysStatus();
    g('m-accts').textContent = st.accountCount;
    g('m-active').textContent = st.activeAccounts;
    g('m-pending-r').textContent = st.pendingReimbursements;
    g('m-pending-a').textContent = st.pendingApplications;

    const logs = await getAuditLogs({ limit: 100 });
    const tbody = g('log-tbody');
    if (logs.data.logs.length) {
      tbody.innerHTML = logs.data.logs.map(l => `
        <tr><td><code style="font-size:10px">${l.action||'-'}</code></td>
          <td>${l.operator_name||'-'}</td>
          <td><small>${l.details||'-'}</small></td>
          <td class="muted" style="font-size:11px">${l.created_at||''}</td>
        </tr>
      `).join('');
    } else { tbody.innerHTML = '<tr><td colspan="4" class="muted">暂无日志</td></tr>'; }
  } catch (e) { console.error(e); }
}

// ===== 个人信息 =====
function loadProfile() {
  g('p-aid').textContent = user.record_id?.substring(0,12) || '-';
  g('p-un').textContent = user.name;
  g('p-dn').textContent = user.name;
  g('p-pl').textContent = user.role;
  g('p-rl').textContent = user.role;
  g('p-jt').textContent = user.department || '-';
  g('p-wt').textContent = user.permission_level || '-';
  g('p-ct').textContent = '-';
}

function showMsg(id, text, type) {
  const el = g(id); if (!el) return;
  el.textContent = text; el.className = 'msg ' + type; el.style.display = 'block';
}
function closeOverlay() { g('overlay').style.display = 'none'; }
