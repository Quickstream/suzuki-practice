// Suzuki Practice Planner UI. Everything is stored in this browser's
// localStorage; the Backup tab moves data between devices.
(function () {
  'use strict';

  var S = window.Scheduler;
  var D = S.dates;
  var STORAGE_KEY = 'suzukiPractice.v1';
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // ---------- state ----------

  function emptyState() {
    return {
      version: 1,
      children: [],
      songOverrides: {},   // id -> { seconds?, hidden? }
      customSongs: [],     // { id, title, composer, seconds, book, afterId }
      settings: { weekStart: 0, printWeeks: 1, printLayout: 'grid', showTimes: true }
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* fall through */ }
    return emptyState();
  }

  function normalize(data) {
    var s = emptyState();
    if (!data || typeof data !== 'object') return s;
    s.children = Array.isArray(data.children) ? data.children : [];
    s.songOverrides = data.songOverrides && typeof data.songOverrides === 'object' ? data.songOverrides : {};
    s.customSongs = Array.isArray(data.customSongs) ? data.customSongs : [];
    Object.assign(s.settings, data.settings || {});
    return s;
  }

  var state = load();
  var ui = { tab: 'plan', childId: null, editChildId: null, printChildIds: null, printStart: null };

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { alert('Could not save. Your browser may be blocking storage.'); }
  }

  function uid(prefix) { return prefix + Math.random().toString(36).slice(2, 9); }

  // ---------- library ----------

  function library() {
    var builtIn = window.SuzukiSongs.SUZUKI_SONGS.map(function (s) {
      var o = state.songOverrides[s.id] || {};
      return Object.assign({}, s, {
        seconds: o.seconds != null ? o.seconds : s.seconds,
        hidden: !!o.hidden
      });
    });
    var customs = state.customSongs.map(function (c) {
      var o = state.songOverrides[c.id] || {};
      return Object.assign({}, c, { builtIn: false, hidden: !!o.hidden });
    });
    var out = [];
    function addAfter(id) {
      customs.forEach(function (c) {
        if ((c.afterId || '') === id) { out.push(c); addAfter(c.id); }
      });
    }
    addAfter('');
    builtIn.forEach(function (s) { out.push(s); addAfter(s.id); });
    // Custom songs whose anchor no longer exists go at the end.
    customs.forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
    // Several pieces share a title ("Gavotte", "Minuet"), so add the
    // composer's surname to those to tell them apart on charts.
    var counts = {};
    out.forEach(function (s) { counts[s.title] = (counts[s.title] || 0) + 1; });
    out.forEach(function (s) {
      s.baseTitle = s.title;
      if (counts[s.title] > 1 && s.composer) s.title += ' (' + s.composer.split(/[\s/]+/).filter(Boolean).pop() + ')';
    });
    return out;
  }

  function songById(id) {
    return library().find(function (s) { return s.id === id; }) || null;
  }

  // ---------- formatting ----------

  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function fmtMinutes(sec) {
    var m = Math.round(sec / 60);
    return m < 1 ? '<1 min' : m + ' min';
  }
  function parseDur(text) {
    text = String(text).trim();
    if (!text) return null;
    if (text.indexOf(':') >= 0) {
      var p = text.split(':');
      var v = Number(p[0]) * 60 + Number(p[1]);
      return isFinite(v) && v > 0 ? v : null;
    }
    var n = Number(text);
    return isFinite(n) && n > 0 ? n : null;
  }
  function shortDate(s) {
    var p = s.split('-').map(Number);
    return MONTHS[p[1] - 1] + ' ' + p[2];
  }
  function songLabel(s) {
    return s.title + (s.builtIn ? ' (Bk ' + s.book + ')' : '');
  }

  function today() {
    var d = new Date();
    return D.format(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  function weekStartOf(date) {
    var wd = D.weekday(date);
    var back = (wd - state.settings.weekStart + 7) % 7;
    return D.addDays(date, -back);
  }

  // ---------- tiny DOM helper ----------

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }

  // ---------- rendering ----------

  var root = document.getElementById('app');

  function render() {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === ui.tab);
    });
    root.innerHTML = '';
    var views = { plan: renderPlan, kids: renderKids, songs: renderSongs, print: renderPrint, backup: renderBackup };
    root.appendChild(views[ui.tab]());
  }

  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { ui.tab = b.dataset.tab; render(); });
  });

  function childChips(selectedId, onPick) {
    return h('div', { class: 'chips' }, state.children.map(function (c) {
      return h('button', {
        class: 'chip' + (c.id === selectedId ? ' active' : ''),
        onclick: function () { onPick(c.id); }
      }, c.name || 'Unnamed');
    }));
  }

  function currentChild() {
    var c = state.children.find(function (x) { return x.id === ui.childId; });
    if (!c && state.children.length) { c = state.children[0]; ui.childId = c.id; }
    return c || null;
  }

  function noKids() {
    return h('div', { class: 'card' },
      h('h2', { text: 'Welcome!' }),
      h('p', null, 'Start by adding your kids on the ', h('strong', null, 'Kids'),
        ' tab: pick the song each one is learning now, and the planner works out which songs they already know and when to review them.'),
      h('button', { class: 'btn primary', onclick: function () { ui.tab = 'kids'; addChild(); } }, 'Add a child'));
  }

  // ----- This Week -----

  function renderPlan() {
    var wrap = h('div');
    if (!state.children.length) { wrap.appendChild(noKids()); return wrap; }
    var child = currentChild();
    wrap.appendChild(childChips(child.id, function (id) { ui.childId = id; render(); }));

    var lib = library();
    var start = weekStartOf(today());
    var plan = S.planDays(lib, child, start, 7);
    var b = plan.built;

    var card = h('div', { class: 'card' });
    var cur = b.current ? b.current.title + (b.current.builtIn ? ' · Book ' + b.current.book : '') : (child.currentSongId === 'done' ? 'All songs learned!' : 'Not set');
    card.appendChild(h('div', { class: 'row' },
      h('div', null,
        h('h2', { style: 'margin:0' }, child.name || 'Unnamed'),
        h('div', { class: 'muted small' },
          'Learning: ', h('strong', null, cur), ' · knows ', String(b.knownCount), ' songs · ',
          b.cycle.length + '-day review cycle')),
      h('div', { class: 'spacer' }),
      b.current ? h('button', { class: 'btn', title: 'Mark the current song as learned and move to the next one', onclick: function () { advance(child); } }, 'Learned it! Next song →') : null,
      h('button', { class: 'btn', title: 'Rearrange which review songs fall on which day', onclick: function () { child.seed = (child.seed || 0) + 1; save(); render(); } }, 'Shuffle review days'),
      h('button', { class: 'btn', onclick: function () { ui.tab = 'kids'; ui.editChildId = child.id; render(); } }, 'Settings')));
    b.warnings.forEach(function (w) { card.appendChild(h('div', { class: 'warning' }, w)); });

    var t = today();
    var week = h('div', { class: 'week' });
    plan.days.forEach(function (d) {
      var head = h('h4', null, h('span', null, DAY_NAMES[D.weekday(d.date)] + ' ' + shortDate(d.date)),
        d.practice ? h('span', { class: 'muted small' }, '~' + fmtMinutes(d.totalSeconds)) : null);
      if (!d.practice) {
        week.appendChild(h('div', { class: 'day rest' + (d.date === t ? ' today' : '') }, head, h('div', { class: 'small' }, 'Rest day')));
        return;
      }
      var ul = h('ul');
      if (d.current) ul.appendChild(h('li', null, h('span', { class: 'tag new' }, 'NEW'), d.current.title));
      d.daily.forEach(function (s) { ul.appendChild(h('li', null, h('span', { class: 'tag daily' }, 'DAILY'), s.title)); });
      d.review.forEach(function (s) {
        ul.appendChild(h('li', null, s.title, s.builtIn ? h('span', { class: 'book-num' }, ' · ' + s.book) : null));
      });
      if (!d.current && !d.daily.length && !d.review.length) ul.appendChild(h('li', { class: 'muted' }, 'Nothing to review yet'));
      week.appendChild(h('div', { class: 'day' + (d.date === t ? ' today' : '') }, head, ul));
    });
    card.appendChild(week);
    wrap.appendChild(card);

    // Full cycle overview.
    var cyc = h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Review cycle'),
      h('p', { class: 'muted small' }, 'Every known song comes up once in each cycle. Practice days step through these in order, continuing from week to week.'));
    var grid = h('div', { class: 'week' });
    b.cycle.forEach(function (songs, i) {
      grid.appendChild(h('div', { class: 'day' },
        h('h4', null, h('span', null, 'Review day ' + (i + 1)), h('span', { class: 'muted small' }, fmtDur(S.sumSeconds(songs)))),
        h('ul', null, songs.length ? songs.map(function (s) { return h('li', null, s.title); }) : h('li', { class: 'muted' }, 'No review songs'))));
    });
    cyc.appendChild(grid);
    wrap.appendChild(cyc);
    return wrap;
  }

  function advance(child) {
    var lib = library().filter(function (s) { return !s.hidden; });
    var idx = lib.findIndex(function (s) { return s.id === child.currentSongId; });
    if (idx < 0) return;
    var next = lib[idx + 1];
    var msg = next ? 'Move ' + (child.name || 'this child') + ' on from "' + lib[idx].title + '" to "' + next.title + '"?'
      : 'Mark "' + lib[idx].title + '" as learned? That was the last song!';
    if (!confirm(msg)) return;
    child.currentSongId = next ? next.id : 'done';
    save(); render();
  }

  // ----- Kids -----

  function addChild() {
    var c = S.withDefaults({ id: uid('c'), name: '', currentSongId: window.SuzukiSongs.SUZUKI_SONGS[0].id, anchorDate: weekStartOf(today()) });
    c.practiceDays = c.practiceDays.slice();
    c.rules = []; c.dailySongIds = []; c.skipSongIds = [];
    state.children.push(c);
    ui.editChildId = c.id; ui.childId = c.id;
    save(); render();
  }

  function renderKids() {
    var wrap = h('div');
    var list = h('div', { class: 'card' }, h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, 'Kids'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn primary', onclick: addChild }, '+ Add child')));
    if (!state.children.length) list.appendChild(h('p', { class: 'muted' }, 'No kids yet.'));
    else {
      if (!state.children.some(function (c) { return c.id === ui.editChildId; })) ui.editChildId = state.children[0].id;
      list.appendChild(h('div', { style: 'margin-top:12px' }, childChips(ui.editChildId, function (id) { ui.editChildId = id; render(); })));
    }
    wrap.appendChild(list);
    var child = state.children.find(function (c) { return c.id === ui.editChildId; });
    if (child) wrap.appendChild(childEditor(child));
    return wrap;
  }

  function songSelect(lib, value, onchange, opts) {
    opts = opts || {};
    var sel = h('select', { onchange: function () { onchange(sel.value); } });
    if (opts.blank) sel.appendChild(h('option', { value: '', text: opts.blank }));
    var group = null, groupKey = null;
    lib.forEach(function (s) {
      if (s.hidden && !opts.includeHidden) return;
      // Custom songs sit in the group of the book they follow.
      var key = s.builtIn ? 'Book ' + s.book : groupKey || 'Your songs';
      if (key !== groupKey) { group = h('optgroup', { label: key }); sel.appendChild(group); groupKey = key; }
      group.appendChild(h('option', { value: s.id, text: s.title + (s.builtIn ? '' : ' ★'), selected: s.id === value }));
    });
    if (opts.done) sel.appendChild(h('option', { value: 'done', text: 'Finished every song', selected: value === 'done' }));
    sel.value = value || '';
    return sel;
  }

  // Checklist of songs, grouped by book, inside a collapsible <details>.
  function songPicker(songs, selectedIds, summary, onchange, open) {
    var sel = {};
    selectedIds.forEach(function (id) { sel[id] = true; });
    var det = h('details', { class: 'picker', open: open });
    var count = h('span', { class: 'muted small' });
    function updateCount() {
      var n = Object.keys(sel).filter(function (k) { return sel[k]; }).length;
      count.textContent = n ? ' (' + n + ' selected)' : '';
    }
    det.appendChild(h('summary', null, summary, count));
    var listEl = h('div', { class: 'picker-list' });
    var lastBook = null;
    songs.forEach(function (s) {
      var bk = s.builtIn ? 'Book ' + s.book : null;
      if (bk && bk !== lastBook) { listEl.appendChild(h('div', { class: 'book-head', text: bk })); lastBook = bk; }
      var cb = h('input', { type: 'checkbox', checked: !!sel[s.id], onchange: function () {
        sel[s.id] = cb.checked; updateCount();
        onchange(Object.keys(sel).filter(function (k) { return sel[k]; }));
      } });
      listEl.appendChild(h('label', null, cb, ' ' + s.title + (s.builtIn ? '' : ' ★')));
    });
    if (!songs.length) listEl.appendChild(h('div', { class: 'muted small' }, 'No songs learned yet.'));
    det.appendChild(listEl);
    updateCount();
    return det;
  }

  function childEditor(child) {
    var lib = library();
    var c = S.withDefaults(child);
    var known = S.knownSongs(lib, c);
    var knownIds = {};
    known.forEach(function (s) { knownIds[s.id] = true; });
    function set(k, v, rerender) { child[k] = v; save(); if (rerender !== false) render(); }

    var card = h('div', { class: 'card' });
    var g = h('div', { class: 'form-grid' });

    g.appendChild(h('label', null, 'Name'));
    g.appendChild(h('input', { type: 'text', value: child.name || '', placeholder: 'e.g. Emma', onchange: function (e) { set('name', e.target.value.trim()); } }));

    g.appendChild(h('label', null, 'Learning now', h('div', { class: 'hint' }, 'Every song before this one counts as known')));
    g.appendChild(songSelect(lib, c.currentSongId, function (v) { set('currentSongId', v || null); }, { done: true }));

    g.appendChild(h('label', null, 'Time on new song', h('div', { class: 'hint' }, 'Minutes, counted in the daily total')));
    g.appendChild(h('div', null, h('input', { type: 'number', min: 0, max: 60, value: c.currentMinutes, onchange: function (e) { set('currentMinutes', Math.max(0, Number(e.target.value) || 0)); } }), ' minutes'));

    g.appendChild(h('label', null, 'Polish songs', h('div', { class: 'hint' }, 'The most recent songs, practiced every day')));
    g.appendChild(h('div', null, h('input', { type: 'number', min: 0, max: 10, value: c.polishCount, onchange: function (e) { set('polishCount', Math.max(0, Number(e.target.value) | 0)); } }), ' songs before the current one'));

    g.appendChild(h('label', null, 'Review plan'));
    var modeName = 'mode-' + child.id;
    g.appendChild(h('div', null,
      h('label', { style: 'display:block' }, h('input', { type: 'radio', name: modeName, checked: c.mode === 'cycle', onchange: function () { set('mode', 'cycle'); } }),
        ' Review every song every ', h('input', { type: 'number', min: 1, max: 30, value: c.cycleDays, disabled: c.mode !== 'cycle', onchange: function (e) { set('cycleDays', Math.max(1, Number(e.target.value) | 0)); } }), ' practice days'),
      h('label', { style: 'display:block; margin-top:6px' }, h('input', { type: 'radio', name: modeName, checked: c.mode === 'minutes', onchange: function () { set('mode', 'minutes'); } }),
        ' About ', h('input', { type: 'number', min: 1, max: 120, value: c.reviewMinutes, disabled: c.mode !== 'minutes', onchange: function (e) { set('reviewMinutes', Math.max(1, Number(e.target.value) || 1)); } }), ' minutes of review a day (cycle length is worked out for you)')));

    g.appendChild(h('label', null, 'Practice days'));
    var dp = h('div', { class: 'days-picker' });
    DAY_NAMES.forEach(function (n, i) {
      dp.appendChild(h('label', null, h('input', { type: 'checkbox', checked: c.practiceDays[i], onchange: function (e) {
        var pd = c.practiceDays.slice(); pd[i] = e.target.checked;
        if (!pd.some(Boolean)) { alert('Pick at least one practice day.'); render(); return; }
        set('practiceDays', pd);
      } }), ' ' + n));
    });
    g.appendChild(dp);

    g.appendChild(h('label', null, 'Cycle starts', h('div', { class: 'hint' }, 'Review day 1 falls on this date')));
    g.appendChild(h('input', { type: 'date', value: c.anchorDate || '', onchange: function (e) { set('anchorDate', e.target.value || null); } }));

    g.appendChild(h('label', null, 'Always every day', h('div', { class: 'hint' }, 'Extra songs to practice daily')));
    g.appendChild(songPicker(known, c.dailySongIds.filter(function (id) { return knownIds[id]; }), 'Choose songs', function (ids) { set('dailySongIds', ids, false); }));

    g.appendChild(h('label', null, 'Don\'t review', h('div', { class: 'hint' }, 'Known songs to leave out')));
    g.appendChild(songPicker(known, c.skipSongIds.filter(function (id) { return knownIds[id]; }), 'Choose songs', function (ids) { set('skipSongIds', ids, false); }));

    card.appendChild(h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, (child.name || 'New child') + ' — settings'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: function () { ui.childId = child.id; ui.tab = 'plan'; render(); } }, 'View plan')));
    card.appendChild(h('div', { style: 'margin-top:12px' }, g));

    // Rules
    card.appendChild(h('h3', null, 'Rules'));
    card.appendChild(h('p', { class: 'muted small', style: 'margin-top:0' }, 'Rules apply to review songs. Songs on the "every day" list are always together.'));
    if (!c.rules.length) card.appendChild(h('p', { class: 'muted small' }, 'No rules yet.'));
    c.rules.forEach(function (r, i) {
      var names = r.songIds.map(function (id) { var s = songById(id); return s ? s.title : '(removed song)'; });
      card.appendChild(h('div', { class: 'rule' },
        h('span', { class: 'kind' }, r.type === 'together' ? 'Same day:' : 'Never same day:'),
        h('span', null, names.join(', ')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn link danger', onclick: function () { var rs = c.rules.slice(); rs.splice(i, 1); set('rules', rs); } }, 'Remove')));
    });
    var newRule = { type: 'together', songIds: [] };
    var typeSel = h('select', { onchange: function () { newRule.type = typeSel.value; } },
      h('option', { value: 'together', text: 'Always practice on the same day' }),
      h('option', { value: 'apart', text: 'Never practice on the same day' }));
    card.appendChild(h('div', { class: 'card', style: 'background:var(--bg); margin-top:10px' },
      h('div', { class: 'row' }, h('strong', null, 'New rule:'), typeSel),
      h('div', { style: 'margin:8px 0' }, songPicker(lib.filter(function (s) { return !s.hidden; }), [], 'Pick 2 or more songs', function (ids) { newRule.songIds = ids; })),
      h('button', { class: 'btn primary', onclick: function () {
        if (newRule.songIds.length < 2) { alert('Pick at least two songs for a rule.'); return; }
        set('rules', c.rules.concat([{ type: newRule.type, songIds: newRule.songIds }]));
      } }, 'Add rule')));

    card.appendChild(h('div', { class: 'row', style: 'margin-top:16px' }, h('div', { class: 'spacer' }),
      h('button', { class: 'btn danger', onclick: function () {
        if (!confirm('Remove ' + (child.name || 'this child') + ' and all their settings?')) return;
        state.children = state.children.filter(function (x) { return x !== child; });
        ui.editChildId = null; save(); render();
      } }, 'Remove child')));
    return card;
  }

  // ----- Songs -----

  function renderSongs() {
    var lib = library();
    var wrap = h('div');
    var card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, 'Song library'), h('div', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: function () {
        if (!confirm('Reset all song lengths and hidden songs to the defaults? Your own songs are kept.')) return;
        state.songOverrides = {}; save(); render();
      } }, 'Reset to defaults')));
    card.appendChild(h('p', { class: 'muted small' },
      'Lengths are approximate playing times (minutes:seconds). Change them to match how long your kids take, since they set the length of each practice day. ',
      'Hidden songs are skipped completely, which is useful if your teacher leaves a piece out or your book edition differs.'));

    var table = h('table', { class: 'songs' }, h('thead', null, h('tr', null,
      h('th', null, '#'), h('th', null, 'Title'), h('th', null, 'Composer'), h('th', null, 'Length'), h('th', null, 'Hide'), h('th'))));
    var tbody = h('tbody');
    var lastBook = null;
    lib.forEach(function (s) {
      if (s.builtIn && s.book !== lastBook) {
        lastBook = s.book;
        tbody.appendChild(h('tr', null, h('td', { colspan: 6, style: 'padding-top:14px' }, h('strong', null, 'Book ' + s.book))));
      }
      var dur = h('input', { class: 'dur', type: 'text', value: fmtDur(s.seconds), onchange: function () {
        var v = parseDur(dur.value);
        if (v == null) { dur.value = fmtDur(s.seconds); return; }
        if (s.builtIn) setOverride(s.id, 'seconds', v);
        else state.customSongs.find(function (c) { return c.id === s.id; }).seconds = v;
        save(); dur.value = fmtDur(v);
      } });
      tbody.appendChild(h('tr', { class: s.hidden ? 'hidden-song' : '' },
        h('td', { class: 'muted' }, s.builtIn ? s.book + '.' + s.num : '★'),
        h('td', null, s.baseTitle),
        h('td', { class: 'muted' }, s.composer || ''),
        h('td', null, dur),
        h('td', null, h('input', { type: 'checkbox', checked: s.hidden, onchange: function (e) { setOverride(s.id, 'hidden', e.target.checked); save(); render(); } })),
        h('td', null, s.builtIn ? null : h('button', { class: 'btn link danger', onclick: function () {
          if (!confirm('Delete "' + s.title + '"?')) return;
          state.customSongs.forEach(function (c) { if (c.afterId === s.id) c.afterId = s.afterId; });
          state.customSongs = state.customSongs.filter(function (c) { return c.id !== s.id; });
          delete state.songOverrides[s.id];
          state.children.forEach(function (ch) { if (ch.currentSongId === s.id) ch.currentSongId = null; });
          save(); render();
        } }, 'Delete'))));
    });
    table.appendChild(tbody);

    // Add custom song
    var f = { title: '', composer: '', dur: '1:00', afterId: lib.length ? lib[lib.length - 1].id : '' };
    var addCard = h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Add a song'),
      h('p', { class: 'muted small', style: 'margin-top:0' }, 'For extra pieces your teacher assigns, pre-Twinkle exercises, or songs from another edition.'),
      h('div', { class: 'form-grid' },
        h('label', null, 'Title'), h('input', { type: 'text', oninput: function (e) { f.title = e.target.value; } }),
        h('label', null, 'Composer'), h('input', { type: 'text', oninput: function (e) { f.composer = e.target.value; } }),
        h('label', null, 'Length (m:ss)'), h('input', { type: 'text', value: f.dur, class: 'dur', oninput: function (e) { f.dur = e.target.value; } }),
        h('label', null, 'Comes after'), songSelect(lib, f.afterId, function (v) { f.afterId = v; }, { blank: '— At the very beginning —', includeHidden: true })),
      h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn primary', onclick: function () {
        var secs = parseDur(f.dur);
        if (!f.title.trim()) { alert('Give the song a title.'); return; }
        if (secs == null) { alert('Enter a length like 1:30.'); return; }
        var after = songById(f.afterId);
        state.customSongs.push({ id: uid('u'), title: f.title.trim(), composer: f.composer.trim(), seconds: secs, book: after ? after.book : 1, afterId: f.afterId || '' });
        save(); render();
      } }, 'Add song')));

    wrap.appendChild(addCard);
    card.appendChild(table);
    wrap.appendChild(card);
    return wrap;
  }

  function setOverride(id, key, value) {
    var o = state.songOverrides[id] || {};
    o[key] = value;
    state.songOverrides[id] = o;
  }

  // ----- Print -----

  function renderPrint() {
    var wrap = h('div');
    if (!state.children.length) { wrap.appendChild(noKids()); return wrap; }
    var st = state.settings;
    if (!ui.printStart) ui.printStart = weekStartOf(today());
    if (!ui.printChildIds) ui.printChildIds = state.children.map(function (c) { return c.id; });

    var controls = h('div', { class: 'card' },
      h('h2', null, 'Print a practice chart'),
      h('div', { class: 'form-grid' },
        h('label', null, 'Kids'),
        h('div', null, state.children.map(function (c) {
          return h('label', { style: 'margin-right:12px' }, h('input', { type: 'checkbox', checked: ui.printChildIds.indexOf(c.id) >= 0, onchange: function (e) {
            ui.printChildIds = ui.printChildIds.filter(function (x) { return x !== c.id; });
            if (e.target.checked) ui.printChildIds.push(c.id);
            render();
          } }), ' ' + (c.name || 'Unnamed'));
        })),
        h('label', null, 'Starting'),
        h('div', { class: 'row' },
          h('input', { type: 'date', value: ui.printStart, onchange: function (e) { if (e.target.value) { ui.printStart = e.target.value; render(); } } }),
          h('button', { class: 'btn', onclick: function () { ui.printStart = weekStartOf(today()); render(); } }, 'This week'),
          h('button', { class: 'btn', onclick: function () { ui.printStart = D.addDays(weekStartOf(today()), 7); render(); } }, 'Next week')),
        h('label', null, 'Weeks'),
        h('select', { onchange: function (e) { st.printWeeks = Number(e.target.value); save(); render(); } },
          [1, 2, 3, 4].map(function (n) { return h('option', { value: n, text: n + (n === 1 ? ' week' : ' weeks') + ' (one page per child per week)', selected: st.printWeeks === n }); })),
        h('label', null, 'Layout'),
        h('div', null,
          h('label', { style: 'margin-right:12px' }, h('input', { type: 'radio', name: 'layout', checked: st.printLayout === 'grid', onchange: function () { st.printLayout = 'grid'; save(); render(); } }), ' Grid (a row per song, a column per day)'),
          h('label', null, h('input', { type: 'radio', name: 'layout', checked: st.printLayout === 'lists', onchange: function () { st.printLayout = 'lists'; save(); render(); } }), ' Daily lists (best when they know lots of songs)')),
        h('label', null, 'Week starts on'),
        h('select', { onchange: function (e) { st.weekStart = Number(e.target.value); ui.printStart = weekStartOf(ui.printStart); save(); render(); } },
          h('option', { value: 0, text: 'Sunday', selected: st.weekStart === 0 }),
          h('option', { value: 1, text: 'Monday', selected: st.weekStart === 1 })),
        h('label', null, 'Show song lengths'),
        h('input', { type: 'checkbox', checked: st.showTimes, onchange: function (e) { st.showTimes = e.target.checked; save(); render(); } })),
      h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary', onclick: function () { window.print(); } }, '🖨  Print')));
    wrap.appendChild(controls);

    var pages = buildChartPages();
    var preview = h('div');
    pages.forEach(function (p) { preview.appendChild(p.cloneNode(true)); });
    if (!pages.length) preview.appendChild(h('p', { class: 'muted' }, 'Pick at least one child.'));
    wrap.appendChild(h('h3', null, 'Preview'));
    wrap.appendChild(preview);

    var pa = document.getElementById('print-area');
    pa.innerHTML = '';
    pages.forEach(function (p) { pa.appendChild(p); });
    return wrap;
  }

  function buildChartPages() {
    var lib = library();
    var st = state.settings;
    var pages = [];
    state.children.forEach(function (child) {
      if (ui.printChildIds.indexOf(child.id) < 0) return;
      var built = S.buildCycle(lib, child);
      for (var w = 0; w < st.printWeeks; w++) {
        var start = D.addDays(ui.printStart, w * 7);
        var days = S.planDays(lib, child, start, 7, built).days;
        pages.push(st.printLayout === 'lists' ? listsPage(child, days, start) : gridPage(child, days, start));
      }
    });
    return pages;
  }

  function pageHeader(child, start) {
    var end = D.addDays(start, 6);
    return h('header', null,
      h('h2', null, '🎻 ' + (child.name || 'Practice') + '\'s Practice Chart'),
      h('span', { class: 'sub' }, shortDate(start) + ' – ' + shortDate(end) + ', ' + end.slice(0, 4)));
  }

  function gridPage(child, days, start) {
    var st = state.settings;
    var page = h('section', { class: 'chart-page' }, pageHeader(child, start));
    var thead = h('tr', null, h('th', null, 'Song'), st.showTimes ? h('th', null, 'Time') : null,
      days.map(function (d) { return h('th', { class: 'day-col' }, DAY_NAMES[D.weekday(d.date)], h('br'), shortDate(d.date).split(' ')[1]); }));
    var tbody = h('tbody');
    var ncols = days.length + (st.showTimes ? 2 : 1);

    function section(label) { tbody.appendChild(h('tr', { class: 'section' }, h('td', { colspan: ncols }, label))); }
    function row(song, onDay, durText) {
      tbody.appendChild(h('tr', null,
        h('td', null, song.title),
        st.showTimes ? h('td', { class: 'dur' }, durText || fmtDur(song.seconds)) : null,
        days.map(function (d) {
          var on = d.practice && onDay(d);
          return h('td', { class: 'cell' + (on ? '' : ' off') }, on ? h('span', { class: 'box' }) : null);
        })));
    }

    var practice = days.filter(function (d) { return d.practice; });
    var cur = practice.length && practice[0].current;
    if (cur) {
      section('New song');
      row(cur, function () { return true; }, (Number(S.withDefaults(child).currentMinutes) || 0) + ' min');
    }
    var daily = practice.length ? practice[0].daily : [];
    if (daily.length) {
      section('Every day');
      daily.forEach(function (s) { row(s, function () { return true; }); });
    }
    // Review songs that appear this week, in book order.
    var seen = {}, review = [];
    practice.forEach(function (d) { d.review.forEach(function (s) { if (!seen[s.id]) { seen[s.id] = true; review.push(s); } }); });
    var order = {};
    library().forEach(function (s, i) { order[s.id] = i; });
    review.sort(function (a, b) { return order[a.id] - order[b.id]; });
    if (review.length) {
      section('Review');
      review.forEach(function (s) {
        row(s, function (d) { return d.review.some(function (x) { return x.id === s.id; }); });
      });
    }
    if (st.showTimes) {
      tbody.appendChild(h('tr', { class: 'total' }, h('td', null, 'About'), h('td'),
        days.map(function (d) { return h('td', { class: 'cell' }, d.practice ? Math.round(d.totalSeconds / 60) + 'm' : ''); })));
    }
    tbody.appendChild(h('tr', { class: 'total' }, h('td', null, 'Parent initials'), st.showTimes ? h('td') : null,
      days.map(function (d) { return h('td', { class: 'cell' + (d.practice ? '' : ' off') }); })));
    page.appendChild(h('table', { class: 'chart' }, h('thead', null, thead), tbody));
    page.appendChild(h('div', { class: 'chart-footer' }, h('span', null, 'Check a box each time you play the song.'), h('span', null, 'Great work! ⭐')));
    return page;
  }

  function listsPage(child, days, start) {
    var st = state.settings;
    var page = h('section', { class: 'chart-page' }, pageHeader(child, start));
    var grid = h('div', { class: 'lists' });
    days.forEach(function (d) {
      var box = h('div', { class: 'list' + (d.practice ? '' : ' rest') },
        h('h3', null, DAY_NAMES[D.weekday(d.date)] + ' ' + shortDate(d.date)));
      if (!d.practice) { box.appendChild(h('div', null, 'Rest day')); grid.appendChild(box); return; }
      function item(label, extra) {
        box.appendChild(h('div', { class: 'item' }, h('span', { class: 'box' }), h('span', null, label, st.showTimes && extra ? h('span', { style: 'color:#666' }, ' ' + extra) : null)));
      }
      if (d.current) item('★ ' + d.current.title, '(' + (Number(S.withDefaults(child).currentMinutes) || 0) + ' min)');
      d.daily.forEach(function (s) { item(s.title, fmtDur(s.seconds)); });
      d.review.forEach(function (s) { item(s.title, fmtDur(s.seconds)); });
      if (st.showTimes) box.appendChild(h('div', { class: 'foot' }, 'About ' + fmtMinutes(d.totalSeconds)));
      grid.appendChild(box);
    });
    grid.appendChild(h('div', { class: 'list' }, h('h3', null, 'Notes'), h('div', { style: 'height:80px' })));
    page.appendChild(grid);
    page.appendChild(h('div', { class: 'chart-footer' }, h('span', null, '★ = new song. Check a box each time you play the song.'), h('span', null, 'Great work! ⭐')));
    return page;
  }

  // ----- Backup -----

  function renderBackup() {
    var file = h('input', { type: 'file', accept: 'application/json,.json', onchange: function () {
      var f = file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.children)) throw new Error('bad');
          if (!confirm('Replace everything in this browser with the backup from the file?')) return;
          state = normalize(data); save(); ui.childId = null; ui.printChildIds = null; render();
          alert('Backup restored.');
        } catch (e) { alert('That file doesn\'t look like a practice planner backup.'); }
      };
      reader.readAsText(f);
    } });
    return h('div', null, h('div', { class: 'card' },
      h('h2', null, 'Backup & move to another device'),
      h('p', null, 'Your kids, songs and settings are saved only in this browser. Download a backup to keep them safe, or to open them on another phone or computer.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', onclick: function () {
          var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
          var a = h('a', { href: URL.createObjectURL(blob), download: 'suzuki-practice-backup-' + today() + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
        } }, 'Download backup')),
      h('h3', null, 'Restore from a backup'),
      h('p', { class: 'muted small' }, 'This replaces what is in this browser now.'),
      file));
  }

  render();
})();
