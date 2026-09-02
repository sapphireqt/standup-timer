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

Both routes carry the team in a single `t` query value: the settings JSON encoded as
UTF-8 bytes in base64url.

```
/?t=eyJ2ZXJzaW9uIjoxLCJ1c2VycyI6WyJBbGV4IE1vcmdhbiIsIlNhbSBSaXZlcmEiXSwiZHVyYXRpb25NaW51dGVzIjoxLjV9
```

Going through UTF-8 bytes is what lets `btoa` handle emoji and non-latin names at
all, and the base64url alphabet needs no percent escaping, so nothing in the link
can be mangled by a chat client. It is also the shorter form for anything outside
latin: a four person Cyrillic team costs 197 characters here against 276 percent
escaped. A value that no longer decodes — truncated, retyped, or from a future
format — is ignored rather than shown as mojibake.

Hand-written links keep working too: `?u=Alex&u=Sam&min=2` opens the same standup and
is rewritten to the encoded form on load.

A link wins over whatever the browser has stored, and opening one also saves that
team locally, so a plain `/` still works on the next visit — and gets its query
string back right away.

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
