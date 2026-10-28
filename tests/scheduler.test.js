// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { SUZUKI_SONGS } = require('../js/songs.js');
const S = require('../js/scheduler.js');

const lib = SUZUKI_SONGS;
const id = (title, book = 1) => lib.find((s) => s.book === book && s.title === title).id;
const ids = (songs) => songs.map((s) => s.id);
const total = (songs) => songs.reduce((t, s) => t + s.seconds, 0);

test('song list has unique ids and covers books 1-10', () => {
  assert.strictEqual(new Set(ids(lib)).size, lib.length);
  assert.deepStrictEqual([...new Set(lib.map((s) => s.book))], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  lib.forEach((s) => assert.ok(s.seconds > 0, s.title));
});

test('known songs are everything before the current song', () => {
  const known = S.knownSongs(lib, { currentSongId: id('Lightly Row') });
  assert.deepStrictEqual(known.map((s) => s.title).slice(-1), ['Twinkle Theme']);
  assert.strictEqual(known.length, 5);
});

test('every review song appears exactly once per cycle, polish songs daily', () => {
  const child = { currentSongId: id('Gavotte', 1), cycleDays: 3, polishCount: 2 };
  const b = S.buildCycle(lib, child);
  assert.strictEqual(b.current.title, 'Gavotte');
  assert.deepStrictEqual(b.daily.map((s) => s.title), ['Minuet 3', 'The Happy Farmer']);
  assert.strictEqual(b.cycle.length, 3);
  const all = b.cycle.flat().map((s) => s.id);
  assert.strictEqual(new Set(all).size, all.length);
  assert.strictEqual(all.length, b.knownCount - 2);
});

test('cycle days are balanced in length', () => {
  const b = S.buildCycle(lib, { currentSongId: id('Minuet', 3), cycleDays: 4, polishCount: 1 });
  const loads = b.cycle.map(total);
  const biggest = Math.max(...b.cycle.flat().map((s) => s.seconds));
  assert.ok(Math.max(...loads) - Math.min(...loads) <= biggest, loads.join(','));
});

test('minutes mode picks enough days to stay near the target', () => {
  const b = S.buildCycle(lib, { currentSongId: id('Bourrée', 3), mode: 'minutes', reviewMinutes: 8, polishCount: 1 });
  const loads = b.cycle.map(total);
  assert.ok(b.cycle.length >= Math.ceil(b.reviewSeconds / 480));
  loads.forEach((l) => assert.ok(l <= 480 * 1.15, `day ${l}s exceeds target`));
});

test('together and apart rules are respected', () => {
  const tw = ['Twinkle Variation A', 'Twinkle Variation B', 'Twinkle Variation C', 'Twinkle Variation D'].map((t) => id(t));
  const child = {
    currentSongId: id('Musette', 2),
    cycleDays: 4,
    polishCount: 1,
    rules: [
      { type: 'together', songIds: tw },
      { type: 'apart', songIds: [id('Minuet 1'), id('Minuet 2'), id('Minuet 3')] }
    ]
  };
  for (let seed = 0; seed < 20; seed++) {
    const b = S.buildCycle(lib, { ...child, seed });
    const dayOf = (sid) => b.cycle.findIndex((d) => d.some((s) => s.id === sid));
    assert.strictEqual(new Set(tw.map(dayOf)).size, 1, 'twinkles together');
    const m = [id('Minuet 1'), id('Minuet 2'), id('Minuet 3')].map(dayOf);
    assert.strictEqual(new Set(m).size, 3, 'minuets apart');
    assert.deepStrictEqual(b.warnings, []);
  }
});

test('impossible apart rule produces a warning', () => {
  const b = S.buildCycle(lib, {
    currentSongId: id('May Song'),
    cycleDays: 1,
    polishCount: 0,
    rules: [{ type: 'apart', songIds: [id('Lightly Row'), id('Song of the Wind')] }]
  });
  assert.ok(b.warnings.length > 0);
});

test('skipped songs are not scheduled, pinned songs are daily', () => {
  const b = S.buildCycle(lib, {
    currentSongId: id('Etude'),
    polishCount: 0,
    skipSongIds: [id('Twinkle Variation A')],
    dailySongIds: [id('Perpetual Motion')]
  });
  const all = ids(b.cycle.flat());
  assert.ok(!all.includes(id('Twinkle Variation A')));
  assert.ok(!all.includes(id('Perpetual Motion')));
  assert.deepStrictEqual(ids(b.daily), [id('Perpetual Motion')]);
});

test('plan continues the cycle across weeks and skips rest days', () => {
  const child = {
    currentSongId: id('Waltz', 2),
    cycleDays: 3,
    anchorDate: '2026-11-01', // a Sunday
    practiceDays: [false, true, true, true, true, true, true] // Sundays off
  };
  const week1 = S.planDays(lib, child, '2026-11-01', 7).days;
  const week2 = S.planDays(lib, child, '2026-11-08', 7).days;
  assert.strictEqual(week1[0].practice, false);
  assert.deepStrictEqual(week1.filter((d) => d.practice).map((d) => d.cycleDay), [0, 1, 2, 0, 1, 2]);
  assert.deepStrictEqual(week2.filter((d) => d.practice).map((d) => d.cycleDay), [0, 1, 2, 0, 1, 2]);
  const twoWeeks = S.planDays(lib, { ...child, cycleDays: 4 }, '2026-11-08', 7).days;
  assert.strictEqual(twoWeeks[1].cycleDay, 6 % 4);
});

test('date helpers handle DST and month boundaries', () => {
  assert.strictEqual(S.dates.addDays('2026-03-07', 2), '2026-03-09');
  assert.strictEqual(S.dates.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(S.dates.weekday('2026-10-28'), 3);
  assert.strictEqual(S.dates.practiceDaysBetween('2026-11-08', '2026-11-01', [true, true, true, true, true, true, true]), -7);
});
