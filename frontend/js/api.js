// api.js - 绾墠绔増锛岄€氳繃Worker浠ｇ悊璋冮涔itable API

// ===== 閰嶇疆 =====
const BASE = ''; // Worker在同一域名，空字符串
const APP_TOKEN = 'QWVzbV6wFajPfbs5GzRcKeW1nMh';
const TABLES = {
  categories: 'tblqgPRebA35g5sX',
  drafts: 'tblPeMbYznmk8lB1',
  pending: 'tblFFXrw3PvfMQwY',
  approved: 'tblmiZwAQLbESeaN',
  monthly: 'tblOnXPJAwEf5YMR',
  archive: 'tbl5j1pKMd0skEVr',
  audit: 'tblRUZYr0w7GfO44',
  groups: 'tblnlJ3H6RthTN1k',
  rules: 'tblRcRNzoGEepH4K',
  users: 'tblrvH4zFRwQRj0j',
};
const ROLE_LV = { '鑰佹澘': 1, '璐㈠姟': 2, '瀹℃壒浜?: 3, '鍛樺伐': 4 };

// ===== 鐢ㄦ埛浼氳瘽绠＄悊 =====
let currentUser = null;

function loadUser() {
  const data = localStorage.getItem('mci_user');
  if (data) {
    currentUser = JSON.parse(data);
    return currentUser;
  }
  return null;
}

function saveUser(user) {
  currentUser = user;
  localStorage.setItem('mci_user', JSON.stringify(user));
}

function clearUser() {
  currentUser = null;
  localStorage.removeItem('mci_user');
}

function getCurrentUser() { return currentUser || loadUser(); }
function hasLevel(lv) { const u = getCurrentUser(); return u && (ROLE_LV[u.role] || 4) <= lv; }

// ===== Bitable API璋冪敤锛堥€氳繃Worker浠ｇ悊锛?====
async function bitable(method, path, body) {
  const url = ''; '';
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  try {
    const r = await fetch(BASE + path, opts);
    const d = await r.json();
    if (d.code !== 0 && d.code !== undefined) throw new Error(d.msg || 'API閿欒');
    return d;
  } catch (e) {
    if (e.message === 'Failed to fetch') throw new Error('缃戠粶閿欒锛岃妫€鏌orker鍦板潃');
    throw e;
  }
}

// 鑾峰彇鎵€鏈夎褰曪紙鑷姩鍒嗛〉锛?async function getAll(tableId) {
  let all = [], pageToken = null;
  do {
    let path = `/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records?page_size=500`;
    if (pageToken) path += '&page_token=' + pageToken;
    const r = await bitable('GET', path);
    const items = r.data?.items || r.items || [];
    all = all.concat(items);
    pageToken = r.data?.page_token || r.page_token;
  } while (pageToken);
  return all;
}

// 鍒涘缓璁板綍
async function createRec(tableId, fields) {
  const r = await bitable('POST', `/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records`, { fields });
  return r.data?.record || r.record;
}

// 鏇存柊璁板綍
async function updateRec(tableId, recordId, fields) {
  const r = await bitable('PUT', `/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`, { fields });
  return r.data?.record || r.record;
}

// 鑾峰彇鍗曟潯
async function getRec(tableId, recordId) {
  const r = await bitable('GET', `/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`);
  return r.data?.record || r.record;
}

// 鍒犻櫎璁板綍
async function delRec(tableId, recordId) {
  await bitable('DELETE', `/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`);
}

// ===== 涓氬姟API =====

// 鐧诲綍
async function login(name) {
  const all = await getAll(TABLES.users);
  const user = all.find(r => (r.fields.濮撳悕 || r.fields.鍚嶇О) === name);
  if (!user) throw new Error('鏈壘鍒扮敤鎴凤紝璇疯仈绯荤鐞嗗憳娣诲姞');

  // 鑾峰彇瑙掕壊
  let role = '鍛樺伐';
  const gl = user.fields.鎵€灞炴潈闄愮粍;
  if (gl && gl.length) {
    try {
      const g = await getRec(TABLES.groups, gl[0]);
      if (g && g.fields) role = g.fields.鍚嶇О || '鍛樺伐';
    } catch (e) {}
  }

  const userInfo = {
    name: user.fields.濮撳悕 || user.fields.鍚嶇О,
    role,
    permission_level: ROLE_LV[role] || 4,
    department: user.fields.閮ㄩ棬 || '',
    superior: user.fields.涓婄骇瀹℃壒浜?|| '',
    record_id: user.record_id,
  };
  saveUser(userInfo);
  return userInfo;
}

// 鐧诲嚭
function logout() {
  clearUser();
  window.location.reload();
}

// 鍒嗙被鏁版嵁
async function getCategories() {
  const all = await getAll(TABLES.categories);
  const valid = all.filter(c => c.fields.鎶ラ攢澶х被 && c.fields.鎶ラ攢缁嗙被);
  const grouped = {};
  valid.forEach(c => {
    const main = Array.isArray(c.fields.鎶ラ攢澶х被) ? c.fields.鎶ラ攢澶х被[0] : c.fields.鎶ラ攢澶х被;
    if (!grouped[main]) grouped[main] = { subs: [], notes: [] };
    if (c.fields.鎶ラ攢缁嗙被 && !grouped[main].subs.includes(c.fields.鎶ラ攢缁嗙被)) grouped[main].subs.push(c.fields.鎶ラ攢缁嗙被);
    if (c.fields.澶囨敞缁嗗垎鐢ㄩ€?&& !grouped[main].notes.includes(c.fields.澶囨敞缁嗗垎鐢ㄩ€?) grouped[main].notes.push(c.fields.澶囨敞缁嗗垎鐢ㄩ€?;
  });
  return { authed: !!getCurrentUser(), categories: getCurrentUser() ? grouped : Object.keys(grouped) };
}

// 鑾峰彇鎶ラ攢鍒楄〃
async function getReimbList(params = {}) {
  const user = getCurrentUser();
  if (!user) return { data: [], total: 0 };
  const { search, status, category, page = 1, limit = 50 } = params;
  let all = [];

  if (user.role === '璐㈠姟' || user.role === '鑰佹澘') {
    (await getAll(TABLES.pending)).forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'pending' }));
    (await getAll(TABLES.approved)).forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'approved' }));
    (await getAll(TABLES.archive)).forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'archive' }));
  } else if (user.role === '瀹℃壒浜?) {
    (await getAll(TABLES.pending)).forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'pending' }));
    (await getAll(TABLES.approved)).forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'approved' }));
  } else {
    (await getAll(TABLES.drafts)).filter(r => (r.fields.鍚嶇О || r.fields.鐢宠浜? === user.name)
      .forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'draft' }));
    (await getAll(TABLES.archive)).filter(r => (r.fields.鍚嶇О || r.fields.鐢宠浜? === user.name)
      .forEach(r => all.push({ ...r.fields, _rid: r.record_id, _src: 'archive' }));
  }

  // 杩囨护
  if (search) all = all.filter(i => (i.璐圭敤璇存槑||'').includes(search) || (i.鍚嶇О||'').includes(search));
  if (category) all = all.filter(i => {
    const c = i.鎶ラ攢澶х被; return Array.isArray(c) ? c.includes(category) : c === category;
  });
  const sm = {
    pending: i => i._src === 'pending' || !i.瀹℃壒鎰忚,
    approved: i => i.瀹℃壒鎰忚 === '宸查€氳繃',
    rejected: i => i.瀹℃壒鎰忚 === '宸查┏鍥?,
  };
  if (status && sm[status]) all = all.filter(sm[status]);

  all.sort((a, b) => ((b.鐢宠鏃ユ湡||b.鍚嶇О||'') > (a.鐢宠鏃ユ湡||a.鍚嶇О||'') ? 1 : -1));
  const total = all.length;
  const start = (page - 1) * limit;
  return { data: all.slice(start, start + limit), total, page, limit };
}

// 缁熻鏁版嵁
async function getStats() {
  const user = getCurrentUser();
  const all = await getAll(TABLES.archive);
  const mine = user.role === '鍛樺伐' ? all.filter(r => r.fields.鐢宠浜?=== user.name) : all;

  const byStatus = [];
  const sm = {};
  mine.forEach(i => {
    const st = i.fields.瀹℃壒鎰忚 || '褰掓。';
    const amt = parseFloat(i.fields.鎶ラ攢閲戦 || 0) || 0;
    if (!sm[st]) sm[st] = { count: 0, total: 0 };
    sm[st].count++; sm[st].total += amt;
  });
  Object.entries(sm).forEach(([k, v]) => byStatus.push({ status: k, count: v.count, total: v.total }));

  const byCategory = [];
  const cm = {};
  mine.forEach(i => {
    const cat = Array.isArray(i.fields.鎶ラ攢澶х被) ? i.fields.鎶ラ攢澶х被[0] : i.fields.鎶ラ攢澶х被 || '鍏朵粬';
    const amt = parseFloat(i.fields.鎶ラ攢閲戦 || 0) || 0;
    if (!cm[cat]) cm[cat] = { count: 0, total: 0 };
    cm[cat].count++; cm[cat].total += amt;
  });
  Object.entries(cm).forEach(([k, v]) => byCategory.push({ category_main: k, count: v.count, total: v.total }));

  const total = mine.reduce((s, i) => s + (parseFloat(i.fields.鎶ラ攢閲戦||0)||0), 0);
  return { data: { byStatus, byCategory, totals: { c: mine.length, t: total } } };
}

// 鍒涘缓鎶ラ攢
async function createReimb(data) {
  const user = getCurrentUser();
  const no = 'BX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase();
  await createRec(TABLES.drafts, {
    鍚嶇О: no, 鐢宠浜? user.name,
    鎶ラ攢澶х被: [data.category_main], 鎶ラ攢缁嗙被: data.category_sub || '',
    澶囨敞缁嗗垎鐢ㄩ€? data.category_note ? [data.category_note] : [],
    鎶ラ攢閲戦: parseFloat(data.amount)||0, 璐圭敤璇存槑: data.description||'',
    鍙戠エ绫诲瀷: data.invoice_type ? [data.invoice_type] : [],
    鏀粯鏂瑰紡: data.payment_method ? [data.payment_method] : [],
    鏀舵璐︽埛: data.account||'', 鎻愪氦鐘舵€? ['宸叉彁浜?],
  });
  await createRec(TABLES.audit, {
    鍚嶇О: `鎻愪氦_${Date.now()}`, 鎿嶄綔绫诲瀷: ['鎻愪氦鎶ラ攢'],
    鎿嶄綔浜? user.name, 鎿嶄綔璇︽儏: `${user.name} 鎻愪氦浜嗘姤閿€ ${no} 楼${data.amount}`,
    鎿嶄綔鏃堕棿: new Date().toLocaleString('zh-CN'),
  });
  return { reimbursement_no: no };
}

// 閫氱煡
async function getNotifs() {
  const user = getCurrentUser();
  const all = await getAll(TABLES.audit);
  return all.filter(r =>
    (r.fields.鎿嶄綔浜?=== user.name) || (r.fields.鎿嶄綔璇︽儏||'').includes(user.name)
  ).sort((a, b) => ((b.fields.鎿嶄綔鏃堕棿||'') > (a.fields.鎿嶄綔鏃堕棿||'') ? 1 : -1)).slice(0, 50);
}

// 瀹¤鏃ュ織
async function getAuditLogs(params = {}) {
  const all = await getAll(TABLES.audit);
  all.sort((a,b) => ((b.fields.鎿嶄綔鏃堕棿||'') > (a.fields.鎿嶄綔鏃堕棿||'') ? 1 : -1));
  const { limit = 100, offset = 0, action } = params;
  let filtered = all;
  if (action) filtered = filtered.filter(r => (r.fields.鎿嶄綔绫诲瀷||'').includes(action));
  const logs = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit)).map(r => ({
    action: r.fields.鎿嶄綔绫诲瀷, operator_name: r.fields.鎿嶄綔浜?
    details: r.fields.鎿嶄綔璇︽儏, created_at: r.fields.鎿嶄綔鏃堕棿,
  }));
  return { data: { logs, total: filtered.length } };
}

// 绯荤粺鐘舵€?async function getSysStatus() {
  const users = await getAll(TABLES.users);
  const pending = await getAll(TABLES.pending);
  return {
    accountCount: users.length,
    activeAccounts: users.filter(u => u.fields.鐘舵€?.[0] !== '鍋滅敤').length,
    pendingReimbursements: pending.length,
    pendingApplications: 0,
    totalAmount: 0,
  };
}

// 鎵€鏈夎处鍙凤紙鐢ㄤ簬绠＄悊椤碉級
async function getAccounts() {
  return await getAll(TABLES.users);
}


