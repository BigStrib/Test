// ============================================
// SUPABASE
// ============================================
const SUPABASE_URL  = 'https://vmumqikxidqxbrpkcdjv.supabase.co';
const SUPABASE_ANON = 'sb_publishable_0sIuvIXiJ6ja-Yt9Fz3-wg_xq7nH9FR';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================
// STATE
// ============================================
let currentUser     = null;
let events          = [];
let currentFilter   = 'all';
let confirmAction   = null;

// ============================================
// HELPERS
// ============================================
function qs(selector)  { return document.querySelector(selector); }
function qsa(selector) { return document.querySelectorAll(selector); }

function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function findEvent(id) {
    for (var i = 0; i < events.length; i++) {
        if (events[i].id === id) return events[i];
    }
    return null;
}

// ============================================
// SMART DATE PARSER
// ============================================
function parseFlexibleDate(input) {
    if (!input || !input.trim()) return null;
    var str = input.trim();

    str = str.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
    str = str.replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thur|thurs|fri|sat|sun)\b[,.]?\s*/gi, '');
    str = str.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

    var months = {
        jan:0,january:0,feb:1,february:1,mar:2,march:2,
        apr:3,april:3,may:4,jun:5,june:5,
        jul:6,july:6,aug:7,august:7,sep:8,september:8,sept:8,
        oct:9,october:9,nov:10,november:10,dec:11,december:11
    };

    var match, m, d, y;

    match = str.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/i);
    if (match) {
        m = months[match[1].toLowerCase()];
        if (m !== undefined) {
            d = new Date(parseInt(match[3]), m, parseInt(match[2]));
            if (!isNaN(d.getTime())) return d;
        }
    }

    match = str.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
    if (match) {
        m = months[match[2].toLowerCase()];
        if (m !== undefined) {
            d = new Date(parseInt(match[3]), m, parseInt(match[1]));
            if (!isNaN(d.getTime())) return d;
        }
    }

    match = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (match) {
        d = new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        if (!isNaN(d.getTime())) return d;
    }

    match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (match) {
        d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        if (!isNaN(d.getTime())) return d;
    }

    match = str.match(/^([a-z]+)\s+(\d{4})$/i);
    if (match) {
        m = months[match[1].toLowerCase()];
        if (m !== undefined) {
            d = new Date(parseInt(match[2]), m, 1);
            if (!isNaN(d.getTime())) return d;
        }
    }

    match = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (match) {
        y = parseInt(match[3]);
        y += y < 50 ? 2000 : 1900;
        d = new Date(y, parseInt(match[1]) - 1, parseInt(match[2]));
        if (!isNaN(d.getTime())) return d;
    }

    var fallback = new Date(str);
    if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1900) return fallback;

    return null;
}

function formatDateToISO(date) {
    var yy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
}

function formatDateDisplay(isoStr) {
    var d = new Date(isoStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
}

// ============================================
// TOAST
// ============================================
function toast(message, type) {
    type = type || 'info';
    var container = qs('#toast-container');
    var icons = {
        success: 'fa-solid fa-circle-check',
        error:   'fa-solid fa-circle-exclamation',
        info:    'fa-solid fa-circle-info'
    };
    var el = document.createElement('div');
    el.className = 'toast-item toast-' + type;
    el.innerHTML = '<i class="' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';
    container.appendChild(el);
    setTimeout(function() {
        el.classList.add('removing');
        setTimeout(function() { el.remove(); }, 300);
    }, 3500);
}

// ============================================
// SCREENS
// ============================================
function showLogin() {
    qs('#login-screen').classList.add('active');
    qs('#app-screen').classList.remove('active');
}

function showApp() {
    qs('#login-screen').classList.remove('active');
    qs('#app-screen').classList.add('active');
    var emailParts = currentUser.email.split('@');
    qs('#user-display-name').textContent = emailParts[0];
    loadEvents();
}

function showLoginError(msg) {
    qs('#login-error').textContent = msg;
}

// ============================================
// SECTIONS
// ============================================
function showSection(name) {
    qsa('.section').forEach(function(s) { s.classList.remove('active'); });
    var target = qs('#section-' + name);
    if (target) target.classList.add('active');

    qsa('.nav-item').forEach(function(n) {
        if (n.dataset.section === name) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });

    closeMobileSidebar();

    if (name === 'schedule')  renderSchedule();
    if (name === 'dashboard') renderDashboard();
}

function closeMobileSidebar() {
    qs('#sidebar').classList.remove('open');
    qs('#sidebar-overlay').classList.remove('active');
}

// ============================================
// AUTH: SESSION CHECK
// ============================================
async function checkSession() {
    try {
        var result  = await db.auth.getSession();
        var session = result.data.session;
        if (session && session.user) {
            currentUser = session.user;
            showApp();
        } else {
            showLogin();
        }
    } catch (err) {
        console.error('Session check error:', err);
        showLogin();
    }
}

// ============================================
// AUTH: LOGIN
// ============================================
async function handleLogin(e) {
    e.preventDefault();

    var email = qs('#login-email').value.trim();
    var pass  = qs('#login-password').value;

    if (!email || !pass) { showLoginError('Please fill in all fields'); return; }

    var btn      = qs('#login-btn');
    var btnText  = btn.querySelector('.btn-login-text');
    var btnLoad  = btn.querySelector('.btn-login-loader');
    var btnArrow = btn.querySelector('.fa-arrow-right');

    btn.disabled = true;
    if (btnText)  btnText.style.display  = 'none';
    if (btnLoad)  btnLoad.style.display  = 'inline';
    if (btnArrow) btnArrow.style.display = 'none';
    qs('#login-error').textContent = '';

    try {
        var result = await db.auth.signInWithPassword({ email: email, password: pass });
        if (result.error) throw result.error;

        currentUser = result.data.user;
        qs('#login-form').reset();
        qs('#login-error').textContent = '';
        showApp();
        toast('Welcome back!', 'success');

    } catch (err) {
        console.error('Login failed:', err);
        var msg = 'Login failed. Please try again.';
        if (err && err.message) {
            if      (err.message.indexOf('Invalid login')       !== -1) msg = 'Incorrect email or password.';
            else if (err.message.indexOf('Too many')            !== -1) msg = 'Too many attempts. Please wait.';
            else if (err.message.indexOf('Email not confirmed') !== -1) msg = 'Email not confirmed.';
            else msg = err.message;
        }
        showLoginError(msg);
    } finally {
        btn.disabled = false;
        if (btnText)  btnText.style.display  = 'inline';
        if (btnLoad)  btnLoad.style.display  = 'none';
        if (btnArrow) btnArrow.style.display = 'inline';
    }
}

// ============================================
// AUTH: LOGOUT
// ============================================
async function handleLogout() {
    try { await db.auth.signOut(); } catch (err) { console.error('Logout error:', err); }
    currentUser = null;
    events = [];
    showLogin();
}

// ============================================
// LOAD EVENTS
// ============================================
async function loadEvents() {
    try {
        var result = await db
            .from('events')
            .select('*')
            .order('event_date', { ascending: true });

        if (result.error) throw result.error;

        events = result.data || [];
        renderDashboard();
        renderSchedule();
    } catch (err) {
        console.error('Load events error:', err);
        toast('Failed to load events: ' + (err.message || 'Unknown error'), 'error');
        if (err.message && (err.message.indexOf('JWT') !== -1 || err.status === 401)) {
            handleLogout();
        }
    }
}

// ============================================
// ADD EVENT
// ============================================
async function addEvent(name, isoDate, cost, description) {
    try {
        var result = await db.from('events')
            .insert([{
                user_id:           currentUser.id,
                event_name:        name,
                event_date:        isoDate,
                event_cost:        parseFloat(cost),
                status:            'pending',
                event_description: description && description.trim() !== '' ? description.trim() : null
            }])
            .select();

        if (result.error) throw result.error;

        events.push(result.data[0]);
        events.sort(function(a, b) { return a.event_date.localeCompare(b.event_date); });
        renderSchedule();
        renderDashboard();
        toast('"' + name + '" added!', 'success');
    } catch (err) {
        console.error('Add event error:', err);
        toast('Failed to add: ' + (err.message || 'Unknown error'), 'error');
    }
}

// ============================================
// UPDATE EVENT
// ============================================
async function updateEvent(id, updates) {
    try {
        var result = await db.from('events')
            .update(updates)
            .eq('id', id)
            .select();

        if (result.error) throw result.error;

        if (result.data && result.data.length > 0) {
            var idx = -1;
            for (var i = 0; i < events.length; i++) {
                if (events[i].id === id) { idx = i; break; }
            }
            if (idx !== -1) events[idx] = result.data[0];
            events.sort(function(a, b) { return a.event_date.localeCompare(b.event_date); });
            renderSchedule();
            renderDashboard();
        }
        return result.data;
    } catch (err) {
        console.error('Update error:', err);
        toast('Update failed: ' + (err.message || 'Unknown error'), 'error');
        throw err;
    }
}

// ============================================
// DELETE EVENT
// ============================================
async function deleteEvent(id) {
    try {
        var result = await db.from('events').delete().eq('id', id);
        if (result.error) throw result.error;

        var newEvents = [];
        for (var i = 0; i < events.length; i++) {
            if (events[i].id !== id) newEvents.push(events[i]);
        }
        events = newEvents;
        renderSchedule();
        renderDashboard();
        toast('Event deleted', 'info');
    } catch (err) {
        console.error('Delete error:', err);
        toast('Delete failed: ' + (err.message || 'Unknown error'), 'error');
    }
}

// ============================================
// CONFIRM MODAL
// ============================================
function showConfirm(options) {
    var modalIcon = qs('#modal-icon');
    modalIcon.innerHTML      = '<i class="' + (options.icon || 'fa-solid fa-question') + '"></i>';
    modalIcon.style.background = options.iconBg    || 'var(--red-glow)';
    modalIcon.style.color      = options.iconColor  || 'var(--red)';

    qs('#modal-title').textContent   = options.title       || 'Confirm';
    qs('#modal-message').textContent = options.message      || 'Are you sure?';

    var confirmBtn       = qs('#modal-confirm-btn');
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.className   = 'btn ' + (options.confirmClass || 'btn-danger');

    confirmAction = options.onConfirm || null;
    qs('#confirm-modal').classList.add('active');
}

function closeConfirm() {
    qs('#confirm-modal').classList.remove('active');
    confirmAction = null;
}

// ============================================
// CONFIRM ACTIONS
// ============================================
function confirmDelete(id) {
    var ev = findEvent(id);
    showConfirm({
        icon:         'fa-solid fa-trash-can',
        iconBg:       'var(--red-glow)',
        iconColor:    'var(--red)',
        title:        'Delete Event',
        message:      'Permanently delete "' + (ev ? ev.event_name : 'this event') + '"? This cannot be undone.',
        confirmText:  'Delete',
        confirmClass: 'btn-danger',
        onConfirm: function() {
            deleteEvent(id);
            closeDetailModal();
        }
    });
}

function confirmAttended(id) {
    var ev = findEvent(id);
    showConfirm({
        icon:         'fa-solid fa-circle-check',
        iconBg:       'var(--green-glow)',
        iconColor:    'var(--green)',
        title:        'Mark as Attended',
        message:      'Mark "' + (ev ? ev.event_name : 'this event') + '" as attended? The cost will be added to your total spent.',
        confirmText:  'Yes, Attended',
        confirmClass: 'btn-success',
        onConfirm: async function() {
            try {
                await updateEvent(id, { status: 'attended' });
                var updated = findEvent(id);
                toast('"' + (updated ? updated.event_name : 'Event') + '" attended — added to total', 'success');
                refreshDetailModal(id);
            } catch (err) { /* handled */ }
        }
    });
}

function confirmCancelled(id) {
    var ev = findEvent(id);
    showConfirm({
        icon:         'fa-solid fa-cloud-rain',
        iconBg:       'var(--red-glow)',
        iconColor:    'var(--red)',
        title:        'Rain-Out / Cancel',
        message:      'Mark "' + (ev ? ev.event_name : 'this event') + '" as cancelled? It will not count toward your total spent.',
        confirmText:  'Yes, Rain-Out',
        confirmClass: 'btn-danger',
        onConfirm: async function() {
            try {
                await updateEvent(id, { status: 'cancelled' });
                var updated = findEvent(id);
                toast('"' + (updated ? updated.event_name : 'Event') + '" cancelled — not counted', 'info');
                refreshDetailModal(id);
            } catch (err) { /* handled */ }
        }
    });
}

function confirmUndo(id) {
    var ev = findEvent(id);
    showConfirm({
        icon:         'fa-solid fa-rotate-left',
        iconBg:       'var(--amber-glow)',
        iconColor:    'var(--amber)',
        title:        'Reset to Pending',
        message:      'Reset "' + (ev ? ev.event_name : 'this event') + '" back to pending status?',
        confirmText:  'Yes, Reset',
        confirmClass: 'btn-warning',
        onConfirm: async function() {
            try {
                await updateEvent(id, { status: 'pending' });
                var updated = findEvent(id);
                toast('"' + (updated ? updated.event_name : 'Event') + '" reset to pending', 'info');
                refreshDetailModal(id);
            } catch (err) { /* handled */ }
        }
    });
}

// ============================================
// EVENT DETAIL MODAL
// ============================================
function openDetailModal(id) {
    var ev = findEvent(id);
    if (!ev) return;
    populateDetailModal(ev);
    qs('#event-detail-modal').classList.add('active');
}

function closeDetailModal() {
    qs('#event-detail-modal').classList.remove('active');
}

function refreshDetailModal(id) {
    var modal = qs('#event-detail-modal');
    if (!modal.classList.contains('active')) return;
    var ev = findEvent(id);
    if (!ev) {
        closeDetailModal();
        return;
    }
    populateDetailModal(ev);
}

function populateDetailModal(ev) {
    // Status badge
    var badgeEl    = qs('#detail-badge');
    var badgeClass = '';
    var badgeLabel = '';
    var badgeIcon  = '';

    if (ev.status === 'pending') {
        badgeClass = 'ev-badge badge-pending';
        badgeLabel = 'Pending';
        badgeIcon  = 'fa-solid fa-clock';
    } else if (ev.status === 'attended') {
        badgeClass = 'ev-badge badge-attended';
        badgeLabel = 'Attended';
        badgeIcon  = 'fa-solid fa-circle-check';
    } else {
        badgeClass = 'ev-badge badge-cancelled';
        badgeLabel = 'Cancelled';
        badgeIcon  = 'fa-solid fa-ban';
    }
    badgeEl.innerHTML = '<span class="' + badgeClass + '"><i class="' + badgeIcon + '"></i> ' + badgeLabel + '</span>';

    // Header color bar
    var header = qs('.detail-header');
    header.className = 'detail-header status-' + ev.status;

    // Title
    qs('#detail-title').textContent = ev.event_name;

    // Description
    var descEl = qs('#detail-description');
    if (ev.event_description && ev.event_description.trim() !== '') {
        descEl.textContent   = ev.event_description;
        descEl.style.display = 'block';
    } else {
        descEl.textContent   = '';
        descEl.style.display = 'none';
    }

    // Date
    qs('#detail-date').textContent = formatDateDisplay(ev.event_date);

    // Cost
    var costEl = qs('#detail-cost');
    costEl.textContent = '$' + parseFloat(ev.event_cost).toFixed(2);
    if      (ev.status === 'attended')  costEl.style.color = 'var(--green)';
    else if (ev.status === 'cancelled') costEl.style.color = 'var(--red)';
    else                                costEl.style.color = 'var(--amber)';

    // Status
    var statusEl   = qs('#detail-status');
    var statusText = ev.status.charAt(0).toUpperCase() + ev.status.slice(1);
    statusEl.textContent = statusText;
    if      (ev.status === 'attended')  statusEl.style.color = 'var(--green)';
    else if (ev.status === 'cancelled') statusEl.style.color = 'var(--red)';
    else                                statusEl.style.color = 'var(--amber)';
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard() {
    var attended  = [];
    var cancelled = [];
    var pending   = [];

    for (var i = 0; i < events.length; i++) {
        if (events[i].status === 'attended')  attended.push(events[i]);
        if (events[i].status === 'cancelled') cancelled.push(events[i]);
        if (events[i].status === 'pending')   pending.push(events[i]);
    }

    var totalSpent = 0;
    for (i = 0; i < attended.length; i++)  totalSpent     += parseFloat(attended[i].event_cost);
    var totalSaved = 0;
    for (i = 0; i < cancelled.length; i++) totalSaved     += parseFloat(cancelled[i].event_cost);
    var totalPotential = 0;
    for (i = 0; i < events.length; i++)    totalPotential += parseFloat(events[i].event_cost);

    qs('#dash-total').textContent     = '$' + totalSpent.toFixed(2);
    qs('#dash-events').textContent    = events.length;
    qs('#dash-attended').textContent  = attended.length;
    qs('#dash-cancelled').textContent = cancelled.length;
    qs('#dash-pending').textContent   = pending.length;
    qs('#dash-saved').textContent     = '$' + totalSaved.toFixed(2);

    // Upcoming
    var upcomingEl = qs('#upcoming-list');
    var todayISO   = formatDateToISO(new Date());
    var upcoming   = [];
    for (i = 0; i < events.length; i++) {
        if (events[i].event_date >= todayISO && events[i].status === 'pending') {
            upcoming.push(events[i]);
            if (upcoming.length >= 6) break;
        }
    }

    if (upcoming.length === 0) {
        upcomingEl.innerHTML = '<div class="panel-empty"><i class="fa-regular fa-calendar-check" style="display:block;font-size:24px;margin-bottom:8px;color:var(--border-light)"></i>No upcoming events</div>';
    } else {
        var html = '';
        for (i = 0; i < upcoming.length; i++) {
            var ev       = upcoming[i];
            var dd       = new Date(ev.event_date + 'T00:00:00');
            var monthStr = dd.toLocaleDateString('en-US', { month: 'short' });
            var dayStr   = dd.getDate();
            html += '<div class="panel-event-row">';
            html += '<div class="panel-event-date"><span class="p-month">' + monthStr + '</span><span class="p-day">' + dayStr + '</span></div>';
            html += '<div class="panel-event-info"><div class="p-name">' + escapeHtml(ev.event_name) + '</div><div class="p-detail">' + formatDateDisplay(ev.event_date) + '</div></div>';
            html += '<div class="panel-event-cost">$' + parseFloat(ev.event_cost).toFixed(2) + '</div>';
            html += '</div>';
        }
        upcomingEl.innerHTML = html;
    }

    // Summary
    var summaryEl  = qs('#summary-panel');
    var avgCost    = attended.length > 0 ? totalSpent / attended.length : 0;
    var attendRate = events.length   > 0 ? Math.round(attended.length / events.length * 100) : 0;

    summaryEl.innerHTML =
        '<div class="summary-row"><span class="s-label"><i class="fa-solid fa-coins" style="color:var(--green)"></i> Total Spent</span><span class="s-value" style="color:var(--green)">$' + totalSpent.toFixed(2) + '</span></div>'
      + '<div class="summary-row"><span class="s-label"><i class="fa-solid fa-piggy-bank" style="color:var(--purple)"></i> Cancelled Event Total</span><span class="s-value" style="color:var(--purple)">$' + totalSaved.toFixed(2) + '</span></div>'
      + '<div class="summary-row"><span class="s-label"><i class="fa-solid fa-chart-line" style="color:var(--cyan)"></i> Avg per Event</span><span class="s-value" style="color:var(--cyan)">$' + avgCost.toFixed(2) + '</span></div>'
      + '<div class="summary-row"><span class="s-label"><i class="fa-solid fa-wallet" style="color:var(--amber)"></i> Total Potential</span><span class="s-value" style="color:var(--amber)">$' + totalPotential.toFixed(2) + '</span></div>'
      + '<div class="summary-row"><span class="s-label"><i class="fa-solid fa-percent" style="color:var(--blue)"></i> Attendance Rate</span><span class="s-value" style="color:var(--blue)">' + attendRate + '%</span></div>';
}

// ============================================
// RENDER SCHEDULE
// ============================================
function renderSchedule() {
    var container = qs('#schedule-container');
    var emptyEl   = qs('#schedule-empty');

    var filtered = [];
    for (var i = 0; i < events.length; i++) {
        if (currentFilter === 'all' || events[i].status === currentFilter) {
            filtered.push(events[i]);
        }
    }

    if (filtered.length === 0) {
        container.style.display = 'none';
        emptyEl.style.display   = 'block';
        return;
    }

    container.style.display = 'flex';
    emptyEl.style.display   = 'none';

    var groups     = {};
    var groupOrder = [];
    for (i = 0; i < filtered.length; i++) {
        var ev    = filtered[i];
        var dd    = new Date(ev.event_date + 'T00:00:00');
        var key   = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0');
        var label = dd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!groups[key]) {
            groups[key] = { label: label, events: [] };
            groupOrder.push(key);
        }
        groups[key].events.push(ev);
    }

    groupOrder.sort();

    var html = '';
    for (i = 0; i < groupOrder.length; i++) {
        var g = groups[groupOrder[i]];
        html += '<div class="month-group">';
        html += '<div class="month-header"><h2>' + g.label + '</h2>';
        html += '<span class="month-count">' + g.events.length + ' event' + (g.events.length !== 1 ? 's' : '') + '</span></div>';
        for (var j = 0; j < g.events.length; j++) {
            html += renderEventRow(g.events[j]);
        }
        html += '</div>';
    }

    container.innerHTML = html;
}

// ============================================
// RENDER EVENT ROW
// ============================================
function renderEventRow(ev) {
    var dd   = new Date(ev.event_date + 'T00:00:00');
    var wk   = dd.toLocaleDateString('en-US', { weekday: 'short' });
    var day  = dd.getDate();
    var mon  = dd.toLocaleDateString('en-US', { month: 'short' });
    var cost = parseFloat(ev.event_cost).toFixed(2);

    var statusClass = 'ev-' + ev.status;

    var badgeHtml = '';
    if (ev.status === 'pending') {
        badgeHtml = '<span class="ev-badge badge-pending"><i class="fa-solid fa-clock"></i> Pending</span>';
    } else if (ev.status === 'attended') {
        badgeHtml = '<span class="ev-badge badge-attended"><i class="fa-solid fa-circle-check"></i> Attended</span>';
    } else {
        badgeHtml = '<span class="ev-badge badge-cancelled"><i class="fa-solid fa-ban"></i> Cancelled</span>';
    }

    var actions = '';
    if (ev.status === 'pending') {
        actions += '<button class="btn btn-success btn-sm" onclick="event.stopPropagation();confirmAttended(\'' + ev.id + '\')"><i class="fa-solid fa-circle-check"></i> Attended</button>';
        actions += '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();confirmCancelled(\'' + ev.id + '\')"><i class="fa-solid fa-cloud-rain"></i> Rain-Out</button>';
    } else {
        actions += '<button class="btn btn-warning btn-sm" onclick="event.stopPropagation();confirmUndo(\'' + ev.id + '\')"><i class="fa-solid fa-rotate-left"></i> Undo</button>';
    }
    actions += '<button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();startEdit(\'' + ev.id + '\')" title="Edit"><i class="fa-solid fa-pen"></i></button>';
    actions += '<button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();confirmDelete(\'' + ev.id + '\')" title="Delete" style="color:var(--red)"><i class="fa-solid fa-trash-can"></i></button>';

    var descHtml = '';
    if (ev.event_description && ev.event_description.trim() !== '') {
        descHtml = '<div class="ev-description">' + escapeHtml(ev.event_description) + '</div>';
    }

    var html = '';
    html += '<div class="schedule-event ' + statusClass + '" onclick="openDetailModal(\'' + ev.id + '\')">';
    html += '  <div class="ev-date-cell">';
    html += '    <div class="ev-weekday">' + wk  + '</div>';
    html += '    <div class="ev-day">'     + day + '</div>';
    html += '    <div class="ev-month-sm">'+ mon + '</div>';
    html += '  </div>';
    html += '  <div class="ev-info">';
    html += '    <div class="ev-name">' + escapeHtml(ev.event_name) + '</div>';
    html += descHtml;
    html += '    <div class="ev-details">' + badgeHtml + '<span class="ev-cost-display"><i class="fa-solid fa-ticket"></i> $' + cost + '</span></div>';
    html += '  </div>';
    html += '  <div class="ev-cost-cell"><div class="ev-cost-amount">$' + cost + '</div></div>';
    html += '  <div class="ev-actions">' + actions + '</div>';
    html += '</div>';

    return html;
}

// ============================================
// FORM: ADD / EDIT
// ============================================
async function handleFormSubmit(e) {
    e.preventDefault();

    var name        = qs('#event-name').value.trim();
    var dateStr     = qs('#event-date-input').value.trim();
    var costVal     = qs('#event-cost').value;
    var description = qs('#event-description').value.trim();
    var editId      = qs('#edit-event-id').value;

    if (!name || !dateStr || costVal === '') {
        toast('Please fill in all fields', 'error');
        return;
    }

    if (parseFloat(costVal) < 0) {
        toast('Cost cannot be negative', 'error');
        return;
    }

    var parsed = parseFlexibleDate(dateStr);
    if (!parsed) {
        toast('Could not parse that date. Try: June 13 2026 or 6/13/2026', 'error');
        return;
    }

    var isoDate = formatDateToISO(parsed);

    if (editId) {
        try {
            await updateEvent(editId, {
                event_name:        name,
                event_date:        isoDate,
                event_cost:        parseFloat(costVal),
                event_description: description !== '' ? description : null
            });
            toast('"' + name + '" updated!', 'success');
            cancelEdit();
        } catch (err) { /* handled */ }
    } else {
        await addEvent(name, isoDate, costVal, description);
        qs('#event-form').reset();
        qs('#date-preview').textContent          = '';
        qs('#description-char-count').textContent = '0 / 300';
    }
}

function startEdit(id) {
    var ev = findEvent(id);
    if (!ev) return;

    showSection('add');

    qs('#edit-event-id').value     = ev.id;
    qs('#event-name').value        = ev.event_name;
    qs('#event-date-input').value  = formatDateDisplay(ev.event_date);
    qs('#event-cost').value        = parseFloat(ev.event_cost).toFixed(2);
    qs('#event-description').value = ev.event_description || '';

    var descLen = (ev.event_description || '').length;
    qs('#description-char-count').textContent = descLen + ' / 300';

    qs('#form-section-title').innerHTML  = '<i class="fa-solid fa-pen-to-square"></i> Edit Event';
    qs('#form-section-sub').textContent  = 'Modify the event details below';
    qs('#form-submit-text').textContent  = 'Save Changes';
    qs('#form-submit-icon').className    = 'fa-solid fa-check';
    qs('#form-cancel-btn').style.display = 'inline-flex';
    qs('.form-panel').classList.add('editing');

    var preview = qs('#date-preview');
    preview.textContent = 'Parsed: ' + formatDateDisplay(ev.event_date);
    preview.classList.remove('error');
}

function cancelEdit() {
    qs('#edit-event-id').value = '';
    qs('#event-form').reset();
    qs('#form-section-title').innerHTML       = '<i class="fa-solid fa-circle-plus"></i> Add Event';
    qs('#form-section-sub').textContent       = 'Enter event details below';
    qs('#form-submit-text').textContent       = 'Add Event';
    qs('#form-submit-icon').className         = 'fa-solid fa-plus';
    qs('#form-cancel-btn').style.display      = 'none';
    qs('.form-panel').classList.remove('editing');
    qs('#date-preview').textContent           = '';
    qs('#description-char-count').textContent = '0 / 300';
}

// ============================================
// ALL EVENT LISTENERS
// ============================================
function setupListeners() {
    qs('#login-form').addEventListener('submit', handleLogin);

    qs('#toggle-password').addEventListener('click', function() {
        var inp = qs('#login-password');
        if (inp.type === 'password') {
            inp.type = 'text';
            qs('#toggle-password i').className = 'fa-solid fa-eye-slash';
        } else {
            inp.type = 'password';
            qs('#toggle-password i').className = 'fa-solid fa-eye';
        }
    });

    qs('#logout-btn').addEventListener('click', handleLogout);

    qsa('.nav-item').forEach(function(n) {
        n.addEventListener('click', function(e) {
            e.preventDefault();
            showSection(this.dataset.section);
        });
    });

    qs('#mobile-menu-btn').addEventListener('click', function() {
        qs('#sidebar').classList.add('open');
        qs('#sidebar-overlay').classList.add('active');
    });

    qs('#sidebar-overlay').addEventListener('click', closeMobileSidebar);

    qs('#mobile-add-btn').addEventListener('click', function() {
        showSection('add');
    });

    qs('#event-form').addEventListener('submit', handleFormSubmit);

    // Live date preview
    qs('#event-date-input').addEventListener('input', function() {
        var preview = qs('#date-preview');
        var val     = this.value.trim();
        if (!val) {
            preview.textContent = '';
            preview.classList.remove('error');
            return;
        }
        var parsed = parseFlexibleDate(val);
        if (parsed) {
            preview.textContent = '\u2713 ' + formatDateDisplay(formatDateToISO(parsed));
            preview.classList.remove('error');
        } else {
            preview.textContent = 'Could not parse date';
            preview.classList.add('error');
        }
    });

    // Description char counter
    qs('#event-description').addEventListener('input', function() {
        qs('#description-char-count').textContent = this.value.length + ' / 300';
    });

    // Filter chips
    qsa('.filter-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
            currentFilter = this.dataset.filter;
            qsa('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            renderSchedule();
        });
    });

    // Confirm modal — confirm
    qs('#modal-confirm-btn').addEventListener('click', function() {
        if (typeof confirmAction === 'function') {
            confirmAction();
        }
        closeConfirm();
    });

    // Confirm modal — cancel
    qs('#modal-cancel-btn').addEventListener('click', closeConfirm);

    // Confirm modal — overlay click
    qs('#confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) closeConfirm();
    });

    // Detail modal — close button
    qs('#detail-close-btn').addEventListener('click', closeDetailModal);

    // Detail modal — overlay click
    qs('#event-detail-modal').addEventListener('click', function(e) {
        if (e.target === this) closeDetailModal();
    });

    // Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (qs('#confirm-modal').classList.contains('active')) {
                closeConfirm();
                return;
            }
            if (qs('#event-detail-modal').classList.contains('active')) {
                closeDetailModal();
                return;
            }
            if (qs('#edit-event-id').value) {
                cancelEdit();
            }
            closeMobileSidebar();
        }
    });

    // Auth state listener
    db.auth.onAuthStateChange(function(eventType, session) {
        console.log('Auth event:', eventType);
        if (eventType === 'SIGNED_OUT') {
            currentUser = null;
            events      = [];
            showLogin();
        }
    });
}

// ============================================
// BOOT
// ============================================
document.addEventListener('DOMContentLoaded', async function() {
    await checkSession();
    setupListeners();
});