// Practice-plan scheduler.
//
// For each child we split their songs into three groups:
//   current  – the song they are learning now (every practice day)
//   daily    – songs practiced every day: the most recent N songs they know
//              ("polish" songs) plus any songs the family pins as daily
//   review   – every other song they already know, spread over a repeating
//              cycle of practice days so each day has about the same length
//
// The cycle length comes from either a fixed number of days ("cycle" mode) or
// a target number of review minutes per day ("minutes" mode, where the number
// of days is picked so each day stays near that target).
//
// Rules let a family say that songs must be on the same day ("together") or
// never on the same day ("apart").
(function (root) {
  'use strict';

  var DEFAULT_CHILD = {
    name: '',
    currentSongId: null,
    currentMinutes: 5,
    polishCount: 1,
    mode: 'cycle',
    cycleDays: 3,
    reviewMinutes: 10,
    practiceDays: [true, true, true, true, true, true, true], // Sun..Sat
    dailySongIds: [],
    skipSongIds: [],
    rules: [],
    anchorDate: null,
    seed: 0
  };

  function withDefaults(child) {
    var c = {};
    Object.keys(DEFAULT_CHILD).forEach(function (k) {
      c[k] = child[k] !== undefined ? child[k] : DEFAULT_CHILD[k];
    });
    Object.keys(child).forEach(function (k) {
      if (c[k] === undefined) c[k] = child[k];
    });
    return c;
  }

  // ---------- dates ----------

  function parseDate(s) {
    var p = s.split('-').map(Number);
    return Date.UTC(p[0], p[1] - 1, p[2]);
  }
  function formatDate(ms) {
    var d = new Date(ms);
    var m = d.getUTCMonth() + 1;
    var day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  var DAY_MS = 86400000;
  function addDays(s, n) { return formatDate(parseDate(s) + n * DAY_MS); }
  function weekday(s) { return new Date(parseDate(s)).getUTCDay(); }
  function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / DAY_MS); }

  // Number of practice days in [from, to) (negative if to < from).
  function practiceDaysBetween(from, to, practiceDays) {
    var n = daysBetween(from, to);
    var sign = n < 0 ? -1 : 1;
    var start = n < 0 ? to : from;
    var count = 0;
    for (var i = 0; i < Math.abs(n); i++) {
      if (practiceDays[weekday(addDays(start, i))]) count++;
    }
    return sign * count;
  }

  // ---------- helpers ----------

  // Small deterministic PRNG so "shuffle" gives a repeatable plan per seed.
  function rng(seed) {
    var a = (seed >>> 0) + 0x9e3779b9;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sumSeconds(songs) {
    return songs.reduce(function (t, s) { return t + (s.seconds || 0); }, 0);
  }

  // Songs the child already knows: everything before the current song in the
  // (visible) library order.
  function knownSongs(library, child) {
    var visible = library.filter(function (s) { return !s.hidden; });
    if (!child.currentSongId) return [];
    if (child.currentSongId === 'done') return visible;
    var idx = visible.findIndex(function (s) { return s.id === child.currentSongId; });
    return idx < 0 ? [] : visible.slice(0, idx);
  }

  // ---------- cycle building ----------

  // Returns { current, daily, cycle: [[song]], warnings, reviewSeconds }.
  function buildCycle(library, rawChild) {
    var child = withDefaults(rawChild);
    var byId = {};
    library.forEach(function (s) { byId[s.id] = s; });
    var warnings = [];

    var current = child.currentSongId && child.currentSongId !== 'done' ? byId[child.currentSongId] || null : null;
    var known = knownSongs(library, child);
    var knownIds = {};
    known.forEach(function (s) { knownIds[s.id] = true; });

    var skip = {};
    child.skipSongIds.forEach(function (id) { skip[id] = true; });

    var dailyIds = {};
    var polish = Math.max(0, child.polishCount | 0);
    known.slice(Math.max(0, known.length - polish)).forEach(function (s) { dailyIds[s.id] = true; });
    child.dailySongIds.forEach(function (id) { if (knownIds[id]) dailyIds[id] = true; });
    var daily = known.filter(function (s) { return dailyIds[s.id] && !skip[s.id]; });

    var pool = known.filter(function (s) { return !dailyIds[s.id] && !skip[s.id]; });
    var inPool = {};
    pool.forEach(function (s) { inPool[s.id] = true; });

    // Union-find over "together" rules.
    var parent = {};
    pool.forEach(function (s) { parent[s.id] = s.id; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { parent[find(a)] = find(b); }

    child.rules.forEach(function (r) {
      if (r.type !== 'together') return;
      var ids = r.songIds.filter(function (id) { return inPool[id]; });
      for (var i = 1; i < ids.length; i++) union(ids[0], ids[i]);
    });

    var unitMap = {};
    pool.forEach(function (s) {
      var root = find(s.id);
      if (!unitMap[root]) unitMap[root] = { songs: [], seconds: 0, key: root };
      unitMap[root].songs.push(s);
      unitMap[root].seconds += s.seconds || 0;
    });
    var units = Object.keys(unitMap).map(function (k) { return unitMap[k]; });
    var unitOf = {};
    units.forEach(function (u, i) { u.index = i; u.songs.forEach(function (s) { unitOf[s.id] = i; }); });

    // Conflicts from "apart" rules.
    var conflicts = units.map(function () { return {}; });
    child.rules.forEach(function (r) {
      if (r.type !== 'apart') return;
      var everyDay = r.songIds.filter(function (id) {
        return dailyIds[id] || (current && current.id === id);
      });
      var inReview = r.songIds.filter(function (id) { return inPool[id]; });
      if (everyDay.length && everyDay.length + inReview.length > 1) {
        warnings.push('A "never on the same day" rule includes ' + names(everyDay, byId) +
          ', which is practiced every day, so that rule cannot be followed.');
      }
      for (var i = 0; i < inReview.length; i++) {
        for (var j = i + 1; j < inReview.length; j++) {
          var a = unitOf[inReview[i]], b = unitOf[inReview[j]];
          if (a === b) {
            warnings.push(names([inReview[i], inReview[j]], byId) +
              ' are in both a "same day" and a "never same day" rule. Keeping them together.');
          } else {
            conflicts[a][b] = true;
            conflicts[b][a] = true;
          }
        }
      }
    });

    var reviewSeconds = sumSeconds(pool);
    var rand = rng(child.seed);
    // Seeded tie-break, then biggest units first (classic greedy balancing).
    units.forEach(function (u) { u.tie = rand(); });
    var order = units.slice().sort(function (a, b) {
      return (b.seconds - a.seconds) || (a.tie - b.tie);
    });

    function assign(k) {
      var bins = [];
      for (var i = 0; i < k; i++) bins.push({ units: [], seconds: 0 });
      var where = new Array(units.length);
      var violations = 0;
      var offset = Math.floor(rand() * k);
      order.forEach(function (u) {
        var best = -1, bestLoad = Infinity, fallback = -1, fallbackLoad = Infinity;
        for (var j = 0; j < k; j++) {
          var bi = (j + offset) % k;
          var bin = bins[bi];
          if (bin.seconds < fallbackLoad) { fallback = bi; fallbackLoad = bin.seconds; }
          var ok = bin.units.every(function (o) { return !conflicts[u.index][o]; });
          if (ok && bin.seconds < bestLoad) { best = bi; bestLoad = bin.seconds; }
        }
        if (best < 0) { best = fallback; violations++; }
        bins[best].units.push(u.index);
        bins[best].seconds += u.seconds;
        where[u.index] = best;
      });
      improve(bins, where);
      return { bins: bins, violations: violations };
    }

    function fits(unitIdx, bin, ignoreIdx) {
      return bin.units.every(function (o) { return o === ignoreIdx || o === unitIdx || !conflicts[unitIdx][o]; });
    }

    // Local search: move or swap units between days while it lowers the
    // spread of day lengths (sum of squared loads).
    function improve(bins, where) {
      var changed = true, guard = 0;
      while (changed && guard++ < 200) {
        changed = false;
        for (var a = 0; a < bins.length; a++) {
          for (var b = 0; b < bins.length; b++) {
            if (a === b) continue;
            var A = bins[a], B = bins[b];
            // moves
            for (var i = 0; i < A.units.length; i++) {
              var u = A.units[i], us = units[u].seconds;
              if (A.seconds - B.seconds > us && fits(u, B)) {
                A.units.splice(i, 1); A.seconds -= us;
                B.units.push(u); B.seconds += us; where[u] = b;
                changed = true; i--;
              }
            }
            // swaps
            for (var x = 0; x < A.units.length; x++) {
              for (var y = 0; y < B.units.length; y++) {
                var ua = A.units[x], ub = B.units[y];
                var d = units[ua].seconds - units[ub].seconds;
                if (d > 0 && A.seconds - B.seconds > d &&
                    fits(ua, B, ub) && fits(ub, A, ua)) {
                  A.units[x] = ub; B.units[y] = ua;
                  A.seconds -= d; B.seconds += d;
                  where[ua] = b; where[ub] = a;
                  changed = true;
                }
              }
            }
          }
        }
      }
    }

    var k;
    var result;
    if (!units.length) {
      k = 1;
      result = { bins: [{ units: [], seconds: 0 }], violations: 0 };
    } else if (child.mode === 'minutes') {
      var target = Math.max(1, Number(child.reviewMinutes) || 1) * 60;
      k = Math.max(1, Math.ceil(reviewSeconds / target));
      // Add days until each day is close to the target and the rules fit.
      for (;;) {
        result = assign(k);
        var maxLoad = Math.max.apply(null, result.bins.map(function (b) { return b.seconds; }));
        var biggest = order[0].seconds;
        if ((result.violations === 0 && (maxLoad <= target * 1.15 || maxLoad <= biggest)) || k >= units.length) break;
        k++;
      }
    } else {
      k = Math.max(1, Math.min(Number(child.cycleDays) || 1, 60));
      result = assign(k);
    }

    if (result.violations) {
      warnings.push('Not every "never on the same day" rule fits in a ' + k +
        '-day cycle. Try a longer cycle or fewer rules.');
    }

    var libIndex = {};
    library.forEach(function (s, i) { libIndex[s.id] = i; });
    var cycle = result.bins.map(function (bin) {
      var songs = [];
      bin.units.forEach(function (ui) { songs = songs.concat(units[ui].songs); });
      return songs.sort(function (a, b) { return libIndex[a.id] - libIndex[b.id]; });
    });
    // Keep the days in a stable, readable order: by their first song.
    cycle.sort(function (a, b) {
      if (!a.length) return 1;
      if (!b.length) return -1;
      return libIndex[a[0].id] - libIndex[b[0].id];
    });

    return {
      current: current,
      daily: daily,
      cycle: cycle,
      warnings: warnings,
      reviewSeconds: reviewSeconds,
      knownCount: known.length
    };
  }

  function names(ids, byId) {
    var list = ids.map(function (id) { return byId[id] ? '"' + byId[id].title + '"' : id; });
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  // ---------- day-by-day plan ----------

  // Plan for each date in [startDate, startDate + numDays).
  function planDays(library, rawChild, startDate, numDays, prebuilt) {
    var child = withDefaults(rawChild);
    var built = prebuilt || buildCycle(library, child);
    var anchor = child.anchorDate || startDate;
    var k = built.cycle.length;
    var currentSeconds = built.current ? (Number(child.currentMinutes) || 0) * 60 : 0;
    var dailySeconds = sumSeconds(built.daily);
    var days = [];
    var idx = practiceDaysBetween(anchor, startDate, child.practiceDays);
    for (var i = 0; i < numDays; i++) {
      var date = addDays(startDate, i);
      var practice = !!child.practiceDays[weekday(date)];
      var day = { date: date, practice: practice, current: null, daily: [], review: [], cycleDay: null, totalSeconds: 0 };
      if (practice) {
        var c = ((idx % k) + k) % k;
        day.cycleDay = c;
        day.current = built.current;
        day.daily = built.daily;
        day.review = built.cycle[c];
        day.totalSeconds = currentSeconds + dailySeconds + sumSeconds(day.review);
        idx++;
      }
      days.push(day);
    }
    return { built: built, days: days };
  }

  var api = {
    DEFAULT_CHILD: DEFAULT_CHILD,
    withDefaults: withDefaults,
    knownSongs: knownSongs,
    buildCycle: buildCycle,
    planDays: planDays,
    sumSeconds: sumSeconds,
    dates: {
      parse: parseDate, format: formatDate, addDays: addDays,
      weekday: weekday, daysBetween: daysBetween, practiceDaysBetween: practiceDaysBetween
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(this);
