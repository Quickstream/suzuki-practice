# 🎻 Suzuki Practice Planner

A small web app that plans daily violin practice for Suzuki students and prints a weekly check-off chart.

- **Knows the Suzuki Violin School repertoire** (Books 1–10). Pick the song a child is learning now, and every song before it counts as known.
- **Plans review automatically.** The new song and the most recent "polish" songs come up every day. All other known songs rotate through a review cycle, balanced so each day takes about the same time.
- **Two ways to set the review cycle:** "review everything every *N* practice days", or "about *M* minutes of review a day", where the app works out how many days the cycle needs.
- **Rules:** *always practice these songs on the same day* or *never practice these songs on the same day*.
- **Extra controls:** songs to practice every day, songs to leave out of review, practice days of the week, and a shuffle button that rearranges which songs land on which day.
- **Printable charts:** one page per child per week, as either a grid (song × day) or a list for each day, with checkboxes and a row for parent initials.
- **Editable song library:** change song lengths to fit your kids, hide pieces your teacher skips, and add your own songs (pre-Twinkle exercises, extra pieces).
- **No accounts and no server.** Data stays in your browser. Use **Backup** to download a file and restore it on another device.

## Using it

Open `index.html` in a browser, or use the hosted copy (see below).

1. **Kids** → *Add child*: set the name and the song they are learning now, then adjust practice days, review plan and rules.
2. **This Week** shows each day's songs. When a song is learned, press **Learned it! Next song →**.
3. **Print Chart**: choose kids, start date, number of weeks and layout, then press **Print**.

## Hosting on GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**, set *Source* to **Deploy from a branch**, then pick `main` and `/ (root)`.
3. The app will be at `https://<your-user>.github.io/<repo-name>/`.

Each browser keeps its own data. To use the same plan on a phone and a laptop, download a backup on one and restore it on the other.

## About the song list and lengths

The list in `js/songs.js` follows the revised (Alfred / International) editions. Older printings order a few pieces differently, and some movements have moved between books (mainly Books 5–8). Check the list against your books; you can hide, add or re-time songs from the **Songs** tab without touching code.

Song lengths are rough playing times at a comfortable student tempo. Adjust them so the daily totals match real practice.

## Development

Plain HTML, CSS and JavaScript, with no build step and no dependencies.

```
index.html
css/style.css        screen + print styles
js/songs.js          built-in repertoire
js/scheduler.js      planning logic (works in the browser and in Node)
js/app.js            user interface
tests/               scheduler tests
```

Run the tests (Node 18+):

```bash
npm test
```

### How the scheduler works

1. **Known songs** are the visible songs before the current one, in library order.
2. **Daily songs** are the last *N* known songs ("polish" count) plus any songs pinned as daily.
3. The remaining known songs, minus skipped ones, form the **review pool**. Songs joined by *same day* rules merge into one unit.
4. Units are spread across *K* review days. The biggest units go first, each into the shortest day that doesn't break a *never same day* rule. A local search then moves and swaps units to even out the day lengths. In minutes mode, *K* grows until each day is close to the target.
5. Practice days step through review days 1…*K* starting from the child's *cycle start* date. The rotation carries over from week to week, and rest days are skipped.
