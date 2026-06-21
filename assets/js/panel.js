// ===== CONFIG =====
const CONFIG = {
    // API URL - change this to your Vercel deployment URL
    API_URL: '', // Leave empty for localStorage mode, set to 'https://your-app.vercel.app/api' for cloud mode
    MODE: 'local' // 'local' = localStorage, 'cloud' = API
};

// Auto-detect mode
if(CONFIG.API_URL) CONFIG.MODE = 'cloud';

// Auth check
if(localStorage.getItem('dw_auth') !== 'true') {
    window.location.href = 'login.html';
}

// ===== DATABASE LAYER =====
const DB = {
    get(key, def = []) {
        try { return JSON.parse(localStorage.getItem('dw_' + key)) || def; }
        catch { return def; }
    },
    set(key, val) {
        localStorage.setItem('dw_' + key, JSON.stringify(val));
    }
};

// Cloud API wrapper
const CloudDB = {
    token: localStorage.getItem('dw_token'),
    
    async request(endpoint, method = 'GET', body = null) {
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.token
            }
        };
        if(body) opts.body = JSON.stringify(body);
        
        try {
            const res = await fetch(CONFIG.API_URL + endpoint, opts);
            if(res.status === 401) {
                localStorage.removeItem('dw_auth');
                localStorage.removeItem('dw_token');
                window.location.href = 'login.html';
                return null;
            }
            return await res.json();
        } catch(e) {
            console.error('API Error:', e);
            toast('API connection failed', 'error');
            return null;
        }
    }
};


// Init default data
if(!DB.get('keys', null)) DB.set('keys', []);
if(!DB.get('users', null)) DB.set('users', []);
if(!DB.get('logs', null)) DB.set('logs', []);

// ===== UTILITY =====
function genId() { return Math.random().toString(36).substr(2, 9); }
function genKey() {
    const s = () => Math.random().toString(36).substr(2, 4).toUpperCase();
    return `DW-${s()}-${s()}-${s()}`;
}
function fmtDate(d) {
    if(!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function addLog(type, msg) {
    const logs = DB.get('logs');
    logs.unshift({ id: genId(), type, message: msg, time: new Date().toISOString() });
    if(logs.length > 500) logs.length = 500;
    DB.set('logs', logs);
}
function toast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ===== NAVIGATION =====
const main = document.getElementById('main');
const navItems = document.querySelectorAll('.nav-item');
let currentPage = 'dash';

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        currentPage = item.dataset.p;
        render();
    });
});

document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('dw_auth');
    localStorage.removeItem('dw_user');
    localStorage.removeItem('dw_token');
    window.location.href = 'login.html';
});

function render() {
    switch(currentPage) {
        case 'dash': renderDashboard(); break;
        case 'keys': renderKeys(); break;
        case 'users': renderUsers(); break;
        case 'hwid': renderHWID(); break;
        case 'logs': renderLogs(); break;
        case 'settings': renderSettings(); break;
    }
}


// ===== DASHBOARD =====
function renderDashboard() {
    const keys = DB.get('keys');
    const users = DB.get('users');
    const logs = DB.get('logs');
    const active = keys.filter(k => k.status === 'active').length;
    const banned = users.filter(u => u.banned).length;
    
    main.innerHTML = `
    <div class="topbar"><h2>Dashboard</h2><div class="user-badge">● ${localStorage.getItem('dw_user') || 'Admin'}</div></div>
    <div class="content"><div class="page active">
        <div class="stats">
            <div class="stat cyan"><div class="stat-label">Total Keys</div><div class="stat-value">${keys.length}</div></div>
            <div class="stat green"><div class="stat-label">Active</div><div class="stat-value">${active}</div></div>
            <div class="stat purple"><div class="stat-label">Users</div><div class="stat-value">${users.length}</div></div>
            <div class="stat red"><div class="stat-label">Banned</div><div class="stat-value">${banned}</div></div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-head"><h3>Recent Activity</h3></div>
                <div class="card-body">
                    ${logs.slice(0, 8).map(l => `<div class="activity-item"><span class="activity-dot"></span><span style="color:var(--muted);font-size:11px;margin-right:8px">${fmtDate(l.time)}</span>${l.message}</div>`).join('') || '<div style="color:var(--muted);font-size:13px">No activity yet</div>'}
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h3>System Status</h3></div>
                <div class="card-body">
                    <div class="status-row"><span>Mode</span><span style="color:var(--accent)">${CONFIG.MODE === 'cloud' ? '☁ Cloud' : '💾 Local'}</span></div>
                    <div class="status-row"><span>Panel</span><span><span class="online-dot"></span>Online</span></div>
                    <div class="status-row"><span>Keys</span><span style="color:var(--accent)">${active}/${keys.length}</span></div>
                </div>
            </div>
        </div>
    </div></div>`;
}

// ===== KEYS =====
function renderKeys() {
    const keys = DB.get('keys');
    main.innerHTML = `
    <div class="topbar"><h2>Key Management</h2><div class="user-badge">${keys.length} total</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar">
            <button class="btn btn-primary" onclick="openCreateKey()">+ Create Key</button>
            <button class="btn btn-ghost" onclick="openBulkCreate()">⊞ Bulk Create</button>
            <button class="btn btn-ghost" onclick="exportKeys()">↓ Export</button>
            <div class="spacer"></div>
            <input class="input" placeholder="Search keys..." id="keySearch" oninput="filterKeys()" style="width:220px">
        </div>
        <div class="card"><div class="card-body" style="padding:0;overflow-x:auto">
            <table><thead><tr><th>Key</th><th>Duration</th><th>Category</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody id="keysBody">${keys.map(k => keyRow(k)).join('')}</tbody></table>
            ${keys.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--muted)">No keys yet. Create one!</div>' : ''}
        </div></div>
    </div></div>`;
}

function keyRow(k) {
    const badge = k.status === 'active' ? 'badge-active' : k.status === 'frozen' ? 'badge-frozen' : k.status === 'banned' ? 'badge-banned' : 'badge-unused';
    const dur = k.duration === -1 ? 'Lifetime' : k.duration + 'd';
    return `<tr>
        <td class="mono">${k.key}</td><td>${dur}</td>
        <td style="text-transform:capitalize">${k.category}</td>
        <td><span class="badge ${badge}">${k.status}</span></td>
        <td style="font-size:12px;color:var(--muted)">${fmtDate(k.created)}</td>
        <td><div class="actions">
            <button class="btn btn-sm btn-ghost" onclick="editKey('${k.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteKey('${k.id}')">Del</button>
        </div></td></tr>`;
}

function filterKeys() {
    const q = document.getElementById('keySearch').value.toLowerCase();
    const keys = DB.get('keys').filter(k => k.key.toLowerCase().includes(q) || k.category.includes(q) || k.status.includes(q));
    document.getElementById('keysBody').innerHTML = keys.map(k => keyRow(k)).join('');
}

function exportKeys() {
    const keys = DB.get('keys');
    const text = keys.map(k => k.key).join('\n');
    const blob = new Blob([text], {type:'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'keys_' + new Date().toISOString().split('T')[0] + '.txt'; a.click();
    toast('Keys exported');
}


// Key actions
function openCreateKey() {
    showModal('Create Key', `
        <div class="form-group"><label>Duration</label><select class="input" id="mDur">
            <option value="1">1 Day</option><option value="7">7 Days</option><option value="30" selected>30 Days</option>
            <option value="90">90 Days</option><option value="365">1 Year</option><option value="-1">Lifetime</option>
        </select></div>
        <div class="form-group"><label>Category</label><select class="input" id="mCat">
            <option value="basic">Basic</option><option value="premium">Premium</option><option value="vip">VIP</option>
        </select></div>
    `, () => {
        const dur = parseInt(document.getElementById('mDur').value);
        const cat = document.getElementById('mCat').value;
        const keys = DB.get('keys');
        const nk = { id: genId(), key: genKey(), duration: dur, category: cat, status: 'unused', created: new Date().toISOString(), usedBy: null };
        keys.push(nk);
        DB.set('keys', keys);
        addLog('key', `Created: ${nk.key} (${dur === -1 ? 'Lifetime' : dur + 'd'} ${cat})`);
        toast('Key created: ' + nk.key);
        closeModal(); renderKeys();
    });
}

function openBulkCreate() {
    showModal('Bulk Create Keys', `
        <div class="form-group"><label>Amount</label><input type="number" class="input" id="mAmt" value="10" min="1" max="500"></div>
        <div class="form-group"><label>Duration</label><select class="input" id="mDur2">
            <option value="1">1 Day</option><option value="7">7 Days</option><option value="30" selected>30 Days</option>
            <option value="90">90 Days</option><option value="365">1 Year</option><option value="-1">Lifetime</option>
        </select></div>
        <div class="form-group"><label>Category</label><select class="input" id="mCat2">
            <option value="basic">Basic</option><option value="premium">Premium</option><option value="vip">VIP</option>
        </select></div>
    `, () => {
        const amt = Math.min(500, Math.max(1, parseInt(document.getElementById('mAmt').value) || 10));
        const dur = parseInt(document.getElementById('mDur2').value);
        const cat = document.getElementById('mCat2').value;
        const keys = DB.get('keys');
        for(let i = 0; i < amt; i++) keys.push({ id: genId(), key: genKey(), duration: dur, category: cat, status: 'unused', created: new Date().toISOString(), usedBy: null });
        DB.set('keys', keys);
        addLog('key', `Bulk: ${amt} keys (${dur === -1 ? 'Lifetime' : dur + 'd'} ${cat})`);
        toast(`${amt} keys created`);
        closeModal(); renderKeys();
    });
}

function editKey(id) {
    const keys = DB.get('keys');
    const k = keys.find(x => x.id === id);
    if(!k) return;
    showModal('Edit Key', `
        <div class="form-group"><label>Key</label><input class="input mono" value="${k.key}" readonly style="opacity:.6"></div>
        <div class="form-group"><label>Add Days</label><input type="number" class="input" id="mAdd" value="0" min="0"></div>
        <div class="form-group"><label>Status</label><select class="input" id="mSt">
            <option value="unused" ${k.status==='unused'?'selected':''}>Unused</option>
            <option value="active" ${k.status==='active'?'selected':''}>Active</option>
            <option value="frozen" ${k.status==='frozen'?'selected':''}>Frozen</option>
            <option value="banned" ${k.status==='banned'?'selected':''}>Banned</option>
        </select></div>
    `, () => {
        const add = parseInt(document.getElementById('mAdd').value) || 0;
        const st = document.getElementById('mSt').value;
        const keys = DB.get('keys');
        const idx = keys.findIndex(x => x.id === id);
        if(idx === -1) return;
        if(add > 0 && keys[idx].duration !== -1) keys[idx].duration += add;
        keys[idx].status = st;
        DB.set('keys', keys);
        addLog('key', `${k.key} → ${st}${add > 0 ? ', +' + add + 'd' : ''}`);
        toast('Key updated'); closeModal(); renderKeys();
    });
}

function deleteKey(id) {
    if(!confirm('Delete this key?')) return;
    const keys = DB.get('keys');
    const k = keys.find(x => x.id === id);
    DB.set('keys', keys.filter(x => x.id !== id));
    if(k) addLog('key', `Deleted: ${k.key}`);
    toast('Key deleted', 'error'); renderKeys();
}


// ===== USERS =====
function renderUsers() {
    const users = DB.get('users');
    main.innerHTML = `
    <div class="topbar"><h2>Users</h2><div class="user-badge">${users.length} total</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar"><input class="input" placeholder="Search users..." id="userSearch" oninput="filterUsers()" style="width:220px"></div>
        <div class="card"><div class="card-body" style="padding:0;overflow-x:auto">
            <table><thead><tr><th>Username</th><th>Key</th><th>HWID</th><th>Expires</th><th>Last Seen</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="usersBody">${users.map(u => userRow(u)).join('')}</tbody></table>
            ${users.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--muted)">No users yet</div>' : ''}
        </div></div>
    </div></div>`;
}

function userRow(u) {
    const badge = u.banned ? 'badge-banned' : 'badge-active';
    return `<tr>
        <td>${u.username || 'User'}</td>
        <td class="mono" style="font-size:11px">${u.key || '—'}</td>
        <td class="mono" style="font-size:10px">${(u.hwid || '').substring(0, 16)}...</td>
        <td style="font-size:12px">${fmtDate(u.expires)}</td>
        <td style="font-size:12px;color:var(--muted)">${fmtDate(u.lastSeen)}</td>
        <td><span class="badge ${badge}">${u.banned ? 'Banned' : 'Active'}</span></td>
        <td><div class="actions"><button class="btn btn-sm ${u.banned?'btn-ghost':'btn-danger'}" onclick="toggleBan('${u.id}')">${u.banned?'Unban':'Ban'}</button></div></td></tr>`;
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    const users = DB.get('users').filter(u => (u.username||'').toLowerCase().includes(q) || (u.key||'').toLowerCase().includes(q) || (u.hwid||'').toLowerCase().includes(q));
    document.getElementById('usersBody').innerHTML = users.map(u => userRow(u)).join('');
}

function toggleBan(id) {
    const users = DB.get('users');
    const idx = users.findIndex(u => u.id === id);
    if(idx === -1) return;
    users[idx].banned = !users[idx].banned;
    DB.set('users', users);
    addLog('ban', `${users[idx].username || id} ${users[idx].banned ? 'banned' : 'unbanned'}`);
    toast(users[idx].banned ? 'User banned' : 'User unbanned'); renderUsers();
}

// ===== HWID =====
function renderHWID() {
    const users = DB.get('users');
    main.innerHTML = `
    <div class="topbar"><h2>HWID Bindings</h2><div class="user-badge">${users.length} bindings</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar"><input class="input" placeholder="Search HWID..." id="hwidSearch" oninput="filterHWID()" style="width:260px"></div>
        <div class="card"><div class="card-body" style="padding:0;overflow-x:auto">
            <table><thead><tr><th>HWID</th><th>Key</th><th>Bound</th><th>Last Used</th><th>Actions</th></tr></thead>
            <tbody id="hwidBody">${users.map(u => hwidRow(u)).join('')}</tbody></table>
            ${users.length === 0 ? '<div style="padding:30px;text-align:center;color:var(--muted)">No HWID bindings</div>' : ''}
        </div></div>
    </div></div>`;
}

function hwidRow(u) {
    return `<tr>
        <td class="mono" style="font-size:10px">${u.hwid || 'N/A'}</td>
        <td class="mono" style="font-size:11px">${u.key || '—'}</td>
        <td style="font-size:12px">${fmtDate(u.created)}</td>
        <td style="font-size:12px">${fmtDate(u.lastSeen)}</td>
        <td><button class="btn btn-sm btn-warn" onclick="resetHWID('${u.id}')">Reset</button></td></tr>`;
}

function filterHWID() {
    const q = document.getElementById('hwidSearch').value.toLowerCase();
    const users = DB.get('users').filter(u => (u.hwid||'').toLowerCase().includes(q));
    document.getElementById('hwidBody').innerHTML = users.map(u => hwidRow(u)).join('');
}

function resetHWID(id) {
    if(!confirm('Reset HWID? User will need to re-authenticate.')) return;
    const users = DB.get('users');
    const idx = users.findIndex(u => u.id === id);
    if(idx === -1) return;
    users[idx].hwid = null;
    DB.set('users', users);
    addLog('hwid', `Reset for ${users[idx].username || id}`);
    toast('HWID reset'); renderHWID();
}


// ===== LOGS =====
function renderLogs() {
    const logs = DB.get('logs');
    main.innerHTML = `
    <div class="topbar"><h2>Logs</h2><div class="user-badge">${logs.length} entries</div></div>
    <div class="content"><div class="page active">
        <div class="toolbar">
            <select class="input" id="logFilter" onchange="filterLogs()" style="width:150px">
                <option value="all">All</option><option value="auth">Auth</option><option value="key">Keys</option>
                <option value="ban">Bans</option><option value="hwid">HWID</option><option value="system">System</option>
            </select>
            <div class="spacer"></div>
            <button class="btn btn-danger" onclick="clearLogs()">Clear Logs</button>
        </div>
        <div class="card"><div class="card-body" style="padding:0">
            <div class="log-list" id="logList">${logs.map(l => logRow(l)).join('') || '<div style="padding:30px;text-align:center;color:var(--muted)">No logs</div>'}</div>
        </div></div>
    </div></div>`;
}

function logRow(l) {
    return `<div class="log-item"><span class="log-time">${fmtDate(l.time)}</span><span class="log-type ${l.type}">${l.type}</span><span class="log-msg">${l.message}</span></div>`;
}

function filterLogs() {
    const f = document.getElementById('logFilter').value;
    const logs = DB.get('logs').filter(l => f === 'all' || l.type === f);
    document.getElementById('logList').innerHTML = logs.map(l => logRow(l)).join('') || '<div style="padding:30px;text-align:center;color:var(--muted)">No logs</div>';
}

function clearLogs() {
    if(!confirm('Clear all logs?')) return;
    DB.set('logs', []);
    addLog('system', 'Logs cleared');
    toast('Logs cleared'); renderLogs();
}

// ===== SETTINGS =====
function renderSettings() {
    main.innerHTML = `
    <div class="topbar"><h2>Settings</h2></div>
    <div class="content"><div class="page active">
        <div class="grid-2">
            <div class="card">
                <div class="card-head"><h3>Admin Account</h3></div>
                <div class="card-body">
                    <div class="form-group"><label>Username</label><input class="input" value="admin" readonly style="width:100%;opacity:.6"></div>
                    <div class="form-group"><label>New Password</label><input type="password" class="input" id="newPass" placeholder="Enter new password" style="width:100%"></div>
                    <div class="form-group"><label>Confirm</label><input type="password" class="input" id="confPass" placeholder="Confirm password" style="width:100%"></div>
                    <button class="btn btn-primary" onclick="changePass()">Update Password</button>
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h3>Data</h3></div>
                <div class="card-body">
                    <div class="form-group"><label>Export All Data</label><button class="btn btn-ghost" onclick="exportData()" style="width:100%">↓ Download JSON Backup</button></div>
                    <div class="form-group"><label>Import Data</label>
                        <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
                        <button class="btn btn-ghost" onclick="document.getElementById('importFile').click()" style="width:100%">↑ Import JSON Backup</button>
                    </div>
                    <div class="form-group"><label style="color:var(--danger)">Danger Zone</label><button class="btn btn-danger" onclick="resetAll()" style="width:100%">⚠ Reset All Data</button></div>
                </div>
            </div>
            <div class="card">
                <div class="card-head"><h3>API Configuration</h3></div>
                <div class="card-body">
                    <div class="form-group"><label>API URL (for cloud mode)</label><input class="input" id="apiUrlInput" value="${CONFIG.API_URL}" placeholder="https://your-app.vercel.app/api" style="width:100%"></div>
                    <div class="form-group"><label>Current Mode</label><input class="input" value="${CONFIG.MODE}" readonly style="width:100%;opacity:.6"></div>
                    <button class="btn btn-primary" onclick="saveApiConfig()">Save Config</button>
                </div>
            </div>
        </div>
    </div></div>`;
}

function changePass() {
    const p1 = document.getElementById('newPass').value;
    const p2 = document.getElementById('confPass').value;
    if(!p1 || p1.length < 4) { toast('Password too short (min 4)', 'error'); return; }
    if(p1 !== p2) { toast('Passwords do not match', 'error'); return; }
    localStorage.setItem('dw_pass', p1);
    addLog('system', 'Password changed');
    toast('Password updated');
}

function saveApiConfig() {
    const url = document.getElementById('apiUrlInput').value.trim();
    localStorage.setItem('dw_api_url', url);
    toast('Config saved. Reload page to apply.');
}

function exportData() {
    const data = { keys: DB.get('keys'), users: DB.get('users'), logs: DB.get('logs'), exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'darkware_backup_' + new Date().toISOString().split('T')[0] + '.json'; a.click();
    toast('Backup downloaded');
}

function importData(e) {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if(data.keys) DB.set('keys', data.keys);
            if(data.users) DB.set('users', data.users);
            if(data.logs) DB.set('logs', data.logs);
            addLog('system', 'Data imported');
            toast('Data imported'); render();
        } catch { toast('Invalid file', 'error'); }
    };
    reader.readAsText(file);
}

function resetAll() {
    if(!confirm('Delete ALL data?')) return;
    if(!confirm('Last chance. Really?')) return;
    DB.set('keys', []); DB.set('users', []); DB.set('logs', []);
    addLog('system', 'All data reset');
    toast('Data cleared'); render();
}


// ===== MODAL SYSTEM =====
function showModal(title, body, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'modalOverlay';
    overlay.innerHTML = `<div class="modal">
        <div class="modal-head"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modalConfirm">Confirm</button></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });
    document.getElementById('modalConfirm').addEventListener('click', onConfirm);
}

function closeModal() {
    const m = document.getElementById('modalOverlay');
    if(m) m.remove();
}

// ===== INIT =====
// Load saved API URL
const savedUrl = localStorage.getItem('dw_api_url');
if(savedUrl) { CONFIG.API_URL = savedUrl; CONFIG.MODE = savedUrl ? 'cloud' : 'local'; }

// Demo data on first run
if(DB.get('keys').length === 0 && DB.get('users').length === 0 && DB.get('logs').length === 0) {
    const demoKeys = [];
    for(let i = 0; i < 5; i++) {
        demoKeys.push({ id: genId(), key: genKey(), duration: [7,30,90,365,-1][i], category: ['basic','basic','premium','premium','vip'][i], status: ['unused','active','active','frozen','active'][i], created: new Date(Date.now() - Math.random()*7*86400000).toISOString(), usedBy: null });
    }
    DB.set('keys', demoKeys);
    
    DB.set('users', [
        { id: genId(), username: 'player1', key: demoKeys[1].key, hwid: 'a4f2c8e91b3d7f0e2a5c8b1d4e7f0a3c6b9d2e5f8a1c4d7e0b3f6a9c2d5e8f1', created: new Date(Date.now()-3*86400000).toISOString(), lastSeen: new Date().toISOString(), expires: new Date(Date.now()+27*86400000).toISOString(), banned: false },
        { id: genId(), username: 'player2', key: demoKeys[2].key, hwid: 'b5e3d9f02c4e8a1b3d6f9c2e5a8b1d4f7a0c3e6b9d2f5a8c1e4d7b0f3a6c9e2', created: new Date(Date.now()-5*86400000).toISOString(), lastSeen: new Date(Date.now()-12*3600000).toISOString(), expires: new Date(Date.now()+85*86400000).toISOString(), banned: false }
    ]);
    
    addLog('system', 'Panel initialized');
    addLog('auth', 'Admin logged in');
}

render();
