// ===== CONFIG =====
const API = 'https://darkware-api.darkware.workers.dev/api';
const TOKEN = localStorage.getItem('dw_token');

if (!localStorage.getItem('dw_auth') || !TOKEN) {
    window.location.href = 'login.html';
}

// ===== API LAYER =====
async function api(endpoint, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN } };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(API + '/' + endpoint, opts);
        if (res.status === 401) { localStorage.clear(); window.location.href = 'login.html'; return null; }
        return await res.json();
    } catch (e) { toast('API error: ' + e.message, 'error'); return null; }
}

// ===== UTILITY =====
function fmtDate(d) { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function toast(msg, type = 'success') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

// ===== NAVIGATION =====
const main = document.getElementById('main');
const navItems = document.querySelectorAll('.nav-item');
let currentPage = 'dash';

navItems.forEach(item => { item.addEventListener('click', () => { navItems.forEach(n => n.classList.remove('active')); item.classList.add('active'); currentPage = item.dataset.p; render(); }); });
document.getElementById('logout').addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });

function render() {
    switch (currentPage) {
        case 'dash': renderDashboard(); break;
        case 'keys': renderKeys(); break;
        case 'users': renderUsers(); break;
        case 'hwid': renderHWID(); break;
        case 'files': renderFiles(); break;
        case 'logs': renderLogs(); break;
        case 'settings': renderSettings(); break;
    }
}


// ===== DASHBOARD =====
async function renderDashboard() {
    main.innerHTML = `<div class="topbar"><h2>Dashboard</h2><div class="user-badge">Loading...</div></div><div class="content"><div class="page active"><div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div></div></div>`;
    const data = await api('dashboard');
    if (!data) return;
    main.innerHTML = `
    <div class="topbar"><h2>Dashboard</h2><div class="user-badge">● ${localStorage.getItem('dw_user') || 'Admin'}</div></div>
    <div class="content"><div class="page active">
        <div class="stats">
            <div class="stat cyan"><div class="stat-label">Total Keys</div><div class="stat-value">${data.totalKeys}</div></div>
            <div class="stat green"><div class="stat-label">Active</div><div class="stat-value">${data.activeKeys}</div></div>
            <div class="stat purple"><div class="stat-label">Users</div><div class="stat-value">${data.totalUsers}</div></div>
            <div class="stat red"><div class="stat-label">Banned</div><div class="stat-value">${data.bannedKeys}</div></div>
        </div>
        <div class="grid-2">
            <div class="card"><div class="card-head"><h3>Recent Activity</h3></div><div class="card-body">
                ${(data.logs || []).map(l => `<div class="activity-item"><span class="activity-dot"></span><span style="color:var(--muted);font-size:11px;margin-right:8px">${fmtDate(l.time)}</span>${l.message}</div>`).join('') || '<div style="color:var(--muted)">No activity</div>'}
            </div></div>
            <div class="card"><div class="card-head"><h3>System</h3></div><div class="card-body">
                <div class="status-row"><span>Mode</span><span style="color:var(--accent)">☁ Cloud (CF Worker)</span></div>
                <div class="status-row"><span>API</span><span><span class="online-dot"></span>Online</span></div>
                <div class="status-row"><span>Storage</span><span style="color:var(--accent)">KV</span></div>
            </div></div>
        </div>
    </div></div>`;
}

// ===== KEYS =====
let cachedKeys = [];
async function renderKeys() {
    main.innerHTML = `<div class="topbar"><h2>Keys</h2></div><div class="content"><div class="page active"><div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div></div></div>`;
    const data = await api('keys');
    if (!data) return;
    cachedKeys = data.keys || [];
    showKeysUI();
}

function showKeysUI() {
    main.innerHTML = `
    <div class="topbar"><h2>Key Management</h2><div class="user-badge">${cachedKeys.length} total</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openCreateKey()">+ Create Key</button>
            <button class="btn btn-ghost" onclick="openBulkCreate()">⊞ Bulk Create</button>
            <button class="btn btn-ghost" onclick="exportKeys()">↓ Export</button>
            <div class="spacer"></div>
            <input class="input" placeholder="Search..." id="keySearch" oninput="filterKeys()" style="width:200px">
        </div>
        <div class="card"><div class="card-body" style="padding:0;overflow-x:auto">
            <table><thead><tr><th>Key</th><th>Duration</th><th>Category</th><th>Status</th><th>HWID</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody id="keysBody">${cachedKeys.map(k => keyRow(k)).join('')}</tbody></table>
            ${cachedKeys.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--muted)">No keys. Create one!</div>' : ''}
        </div></div>
    </div></div>`;
}

function keyRow(k) {
    const badge = k.status === 'active' ? 'badge-active' : k.status === 'frozen' ? 'badge-frozen' : k.status === 'banned' ? 'badge-banned' : 'badge-unused';
    const dur = k.duration === -1 ? 'Lifetime' : k.duration + 'd';
    const hwid = k.hwid ? k.hwid.substring(0, 10) + '...' : '—';
    return `<tr><td class="mono">${k.key}</td><td>${dur}</td><td style="text-transform:capitalize">${k.category}</td><td><span class="badge ${badge}">${k.status}</span></td><td class="mono" style="font-size:10px">${hwid}</td><td style="font-size:12px;color:var(--muted)">${fmtDate(k.created)}</td><td><div class="actions"><button class="btn btn-sm btn-ghost" onclick="editKey('${k.id}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteKey('${k.id}')">Del</button></div></td></tr>`;
}

function filterKeys() {
    const q = document.getElementById('keySearch').value.toLowerCase();
    const filtered = cachedKeys.filter(k => k.key.toLowerCase().includes(q) || k.category.includes(q) || k.status.includes(q));
    document.getElementById('keysBody').innerHTML = filtered.map(k => keyRow(k)).join('');
}

function exportKeys() {
    const text = cachedKeys.map(k => k.key).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'keys.txt'; a.click();
    toast('Keys exported');
}


// Key actions
function openCreateKey() {
    showModal('Create Key', `
        <div class="form-group"><label>Duration</label><select class="input" id="mDur"><option value="1">1 Day</option><option value="7">7 Days</option><option value="30" selected>30 Days</option><option value="90">90 Days</option><option value="365">1 Year</option><option value="-1">Lifetime</option></select></div>
        <div class="form-group"><label>Category</label><select class="input" id="mCat"><option value="basic">Basic</option><option value="premium">Premium</option><option value="vip">VIP</option></select></div>
    `, async () => {
        const dur = document.getElementById('mDur').value;
        const cat = document.getElementById('mCat').value;
        const res = await api('keys', 'POST', { duration: dur, category: cat });
        if (res) { toast('Key created: ' + (res.keys?.[0]?.key || '')); closeModal(); renderKeys(); }
    });
}

function openBulkCreate() {
    showModal('Bulk Create', `
        <div class="form-group"><label>Amount</label><input type="number" class="input" id="mAmt" value="10" min="1" max="500"></div>
        <div class="form-group"><label>Duration</label><select class="input" id="mDur2"><option value="1">1 Day</option><option value="7">7 Days</option><option value="30" selected>30 Days</option><option value="90">90 Days</option><option value="365">1 Year</option><option value="-1">Lifetime</option></select></div>
        <div class="form-group"><label>Category</label><select class="input" id="mCat2"><option value="basic">Basic</option><option value="premium">Premium</option><option value="vip">VIP</option></select></div>
    `, async () => {
        const amt = parseInt(document.getElementById('mAmt').value) || 10;
        const dur = document.getElementById('mDur2').value;
        const cat = document.getElementById('mCat2').value;
        const res = await api('keys', 'POST', { duration: dur, category: cat, amount: amt });
        if (res) { toast(`${res.count} keys created`); closeModal(); renderKeys(); }
    });
}

function editKey(id) {
    const k = cachedKeys.find(x => x.id === id);
    if (!k) return;
    showModal('Edit Key', `
        <div class="form-group"><label>Key</label><input class="input mono" value="${k.key}" readonly style="opacity:.6"></div>
        <div class="form-group"><label>Add Days</label><input type="number" class="input" id="mAdd" value="0" min="0"></div>
        <div class="form-group"><label>Status</label><select class="input" id="mSt"><option value="unused" ${k.status === 'unused' ? 'selected' : ''}>Unused</option><option value="active" ${k.status === 'active' ? 'selected' : ''}>Active</option><option value="frozen" ${k.status === 'frozen' ? 'selected' : ''}>Frozen</option><option value="banned" ${k.status === 'banned' ? 'selected' : ''}>Banned</option></select></div>
    `, async () => {
        const add = parseInt(document.getElementById('mAdd').value) || 0;
        const st = document.getElementById('mSt').value;
        const res = await api('keys', 'PUT', { id, status: st, addTime: add });
        if (res) { toast('Key updated'); closeModal(); renderKeys(); }
    });
}

async function deleteKey(id) {
    if (!confirm('Delete?')) return;
    const res = await api('keys', 'DELETE', { id });
    if (res) { toast('Deleted', 'error'); renderKeys(); }
}

// ===== USERS =====
async function renderUsers() {
    main.innerHTML = `<div class="topbar"><h2>Users</h2></div><div class="content"><div class="page active"><div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div></div></div>`;
    const data = await api('users');
    if (!data) return;
    const users = data.users || [];
    main.innerHTML = `
    <div class="topbar"><h2>Users</h2><div class="user-badge">${users.length} total</div></div>
    <div class="content"><div class="page active">
        <div class="card"><div class="card-body" style="padding:0;overflow-x:auto">
            <table><thead><tr><th>Key</th><th>HWID</th><th>Category</th><th>Status</th><th>First Used</th><th>Last Used</th><th>Actions</th></tr></thead>
            <tbody>${users.map(u => `<tr><td class="mono" style="font-size:11px">${u.key}</td><td class="mono" style="font-size:10px">${(u.hwid||'').substring(0,16)}...</td><td style="text-transform:capitalize">${u.category}</td><td><span class="badge ${u.status==='banned'?'badge-banned':'badge-active'}">${u.status}</span></td><td style="font-size:12px">${fmtDate(u.firstUsed)}</td><td style="font-size:12px">${fmtDate(u.lastUsed)}</td><td><div class="actions"><button class="btn btn-sm btn-danger" onclick="banUser('${u.id}')">Ban</button><button class="btn btn-sm btn-warn" onclick="resetUserHWID('${u.id}')">Reset</button></div></td></tr>`).join('')}</tbody></table>
            ${users.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--muted)">No users yet</div>' : ''}
        </div></div>
    </div></div>`;
}

async function banUser(id) { await api('users', 'POST', { id, action: 'ban' }); toast('User banned'); renderUsers(); }
async function resetUserHWID(id) { if (!confirm('Reset HWID?')) return; await api('users', 'POST', { id, action: 'reset_hwid' }); toast('HWID reset'); renderUsers(); }

// ===== HWID (same as users but different view) =====
async function renderHWID() { renderUsers(); }


// ===== LOGS =====
async function renderLogs() {
    main.innerHTML = `<div class="topbar"><h2>Logs</h2></div><div class="content"><div class="page active"><div style="padding:40px;text-align:center;color:var(--muted)">Loading...</div></div></div>`;
    const data = await api('logs');
    if (!data) return;
    const logs = data.logs || [];
    main.innerHTML = `
    <div class="topbar"><h2>Logs</h2><div class="user-badge">${logs.length} entries</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar"><div class="spacer"></div><button class="btn btn-danger" onclick="clearLogs()">Clear Logs</button></div>
        <div class="card"><div class="card-body" style="padding:0">
            <div class="log-list">${logs.map(l => `<div class="log-item"><span class="log-time">${fmtDate(l.time)}</span><span class="log-type ${l.type}">${l.type}</span><span class="log-msg">${l.message}</span></div>`).join('') || '<div style="padding:30px;text-align:center;color:var(--muted)">No logs</div>'}</div>
        </div></div>
    </div></div>`;
}

async function clearLogs() { if (!confirm('Clear?')) return; await api('logs', 'DELETE'); toast('Cleared'); renderLogs(); }

// ===== FILES =====
function renderFiles() {
    const files = JSON.parse(localStorage.getItem('dw_files') || '{}');
    main.innerHTML = `
    <div class="topbar"><h2>Files / CDN</h2></div>
    <div class="content"><div class="page active">
        <div class="card"><div class="card-head"><h3>☁ CDN URLs</h3></div><div class="card-body">
            <p style="font-size:12px;color:var(--muted);margin-bottom:16px">Прямые ссылки на файлы в приватном GitHub репо. Loader скачивает отсюда с токеном.</p>
            <div class="form-group"><label>Cheat (reader.exe)</label><input class="input" id="fC" value="${files.cheat || ''}" placeholder="https://raw.githubusercontent.com/..." style="width:100%"></div>
            <div class="form-group"><label>Driver (driver.sys)</label><input class="input" id="fD" value="${files.driver || ''}" placeholder="https://raw.githubusercontent.com/..." style="width:100%"></div>
            <div class="form-group"><label>Mapper (mapper.exe)</label><input class="input" id="fM" value="${files.mapper || ''}" placeholder="https://raw.githubusercontent.com/..." style="width:100%"></div>
            <button class="btn btn-primary" onclick="saveFiles()">Save</button>
        </div></div>
    </div></div>`;
}
function saveFiles() {
    localStorage.setItem('dw_files', JSON.stringify({ cheat: document.getElementById('fC').value, driver: document.getElementById('fD').value, mapper: document.getElementById('fM').value }));
    toast('Saved');
}

// ===== SETTINGS =====
function renderSettings() {
    main.innerHTML = `
    <div class="topbar"><h2>Settings</h2></div>
    <div class="content"><div class="page active">
        <div class="card"><div class="card-head"><h3>API</h3></div><div class="card-body">
            <div class="status-row"><span>Endpoint</span><span style="color:var(--accent);font-size:12px">${API}</span></div>
            <div class="status-row"><span>Mode</span><span style="color:var(--success)">☁ Cloud (Cloudflare Worker + KV)</span></div>
            <div class="status-row"><span>Auth</span><span style="color:var(--success)">JWT Token</span></div>
        </div></div>
    </div></div>`;
}

// ===== MODAL =====
function showModal(title, body, onConfirm) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay active'; ov.id = 'modalOverlay';
    ov.innerHTML = `<div class="modal"><div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modalConfirm">Confirm</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
    document.getElementById('modalConfirm').addEventListener('click', onConfirm);
}
function closeModal() { const m = document.getElementById('modalOverlay'); if (m) m.remove(); }

// ===== INIT =====
render();
