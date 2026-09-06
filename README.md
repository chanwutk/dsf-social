# ERSO reimbursement form helper

A static TypeScript web application for filling an ERSO entertainment reimbursement form. It runs entirely in the browser and can be hosted on GitHub Pages without a server.

## Run locally

Requirements: Node.js 20.11 or newer and npm.

```sh
npm run install:app
npm start
```

Open <http://127.0.0.1:5173>. No API process is required.

## First visit

The app opens a setup dialog when no profile exists in the current browser. The quickest option is to select an already-filled personalized blank ERSO PDF: the app extracts the payee name, address, email, and employee or student ID for confirmation, stores that PDF locally, and reuses its embedded signature. Manual entry and profile JSON import remain available.

The profile, drafts, remembered contacts, and optional file overrides are stored in IndexedDB on that device.

The built-in PDF template is a raster-sanitized copy containing no personal form values, signature data, or interactive fields. From **Profile and files**, you may optionally select:

- A personalized blank PDF to replace the built-in template.
- A PNG or JPEG signature to place on generated PDFs.

Selected files remain in browser storage. Generated PDFs are previewed and downloaded but are not retained by the app.

Clearing this site's browser data removes the profile and drafts. Export the profile or individual draft JSON files if a backup is useful.

## GitHub Pages

The workflow at `.github/workflows/pages.yml` builds and deploys `app/dist` on pushes to `main`, manual runs, and a weekly schedule. In the repository settings, choose **GitHub Actions** as the Pages source.

The private source PDFs under `resources/` and the old filesystem data directory are ignored by Git. Do not force-add them to a public repository. Only `app/public/erso-template.pdf`, the scrubbed public template, belongs in a Pages deployment.

Every deployment (push to `main`, manual run, or Monday at 15:23 UTC) refreshes the public attendee snapshots from [Sky](https://sky.cs.berkeley.edu/people/), [SLICE](https://slice.eecs.berkeley.edu/people/), and [EPIC](https://epic.berkeley.edu/). Changes on a lab website do not trigger deployment themselves. For a local refresh, run `npm --prefix app run refresh:roster` before building.

Snapshots are saved in `app/seed/sky-roster.json`, `app/seed/slice-roster.json`, and `app/seed/epic-roster.json` and compiled into the website's JavaScript. Official rosters are not stored in IndexedDB; only manually added contacts are stored there, per browser. People with matching normalized names across labs appear once, with Sky taking precedence to preserve existing IDs.

Each source refreshes independently: try the live website first; if fetching or parsing fails, query the Internet Archive Wayback Availability API for its most recent available snapshot and parse that archived HTML. If the archive is unavailable or fails validation too, keep the committed snapshot. Requests time out after 20 seconds. Empty pages and results with fewer than 10 people are rejected. Deployment refreshes do not commit changes back to Git, so a later failed deployment refresh falls back to the repository snapshot, not necessarily the most recent successful deployment. Commit locally refreshed JSON files to update those fallbacks.

EPIC uses its homepage person cards, verified against the August 31, 2026 Wayback capture. Archived rosters can be stale. Successful refreshes write provenance to `app/seed/<lab>-roster-meta.json` (live/archive URL, archive timestamp, refresh time) and log the source in GitHub Actions. This fallback uses the Internet Archive, not Google Cache.

## Verification

```sh
npm test
npm run build
npm --prefix app run test:e2e -- --project=chromium
```

Playwright profiles are also configured for Firefox and WebKit. PDF tests generate from the public sanitized template.

To regenerate the public template after intentionally replacing the private source form, install Poppler (`pdftoppm`) and run:

```sh
npm --prefix app run sanitize:template
```
