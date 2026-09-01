# Daily Standup Timer

A minimal, large-screen friendly web app for running daily standups.

## Features

- `/settings` keeps the participant list and timer duration in the page link and in
  the current browser.
- Every edit on `/settings` rewrites the query string, so copying the address bar
  shares the exact team.
- `/` shuffles the participants whenever it opens.
- Only one countdown runs at a time; starting another participant pauses the previous one.
- Active rows pulse slowly and timers display minutes, seconds, and centiseconds.
- Countdown digits stay hidden while a participant is speaking and appear on pause.
- Finishing a standup celebrates with confetti and ranks only participants whose timers ran.

## Shareable links

Both routes read the team from the query string: one `u` value per person plus
`min` for the per-person minutes.

```
/?u=Alex%20Morgan&u=Sam%20Rivera&min=1.5
```

`URLSearchParams` does the encoding, so emoji, non-latin names, and separators such
as `&` or `=` survive the trip through the address bar. A link wins over whatever the
browser has stored, and opening one also saves that team locally, so a plain `/`
still works on the next visit — and gets its query string back right away.

## Development

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Use `npm test` to build the deployment bundle and run the route-level tests.

## GitHub Pages

The project exports to static files in `dist/client/`. Pushes to `main` deploy that
directory through `.github/workflows/deploy-pages.yml`.

For a project repository, the workflow injects the GitHub Pages base path so
assets and both routes work under `https://<user>.github.io/<repository>/`.
