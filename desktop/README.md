# ZAG Digital Atlas, desktop application

The same atlas as the website, packed as a Windows installer (`.exe`), a portable `.exe`, a macOS disk image and a Linux AppImage. The pages, data, models and API files travel inside the application; the map tiles, the satellite imagery and the live news are read from the internet.

## How it is built

The build runs on GitHub, not on a laptop: `.github/workflows/desktop.yml` builds the Windows files on a Windows machine, the macOS image on a Mac and the AppImage on Linux. It runs on every tag that starts with `v` (for example `v1.0.0`) and attaches the files to the release of that tag. It can also be started by hand from the Actions page (Desktop builds, Run workflow); the files then appear as artifacts of the run.

To publish a version: in the repository, create and push a tag.

    git tag v1.0.0
    git push origin v1.0.0

A few minutes later the release `v1.0.0` holds `ZAG-Digital-Atlas-1.0.0-win-x64.exe` (installer) and the portable `.exe`.

## Building on your own computer

With Node.js 20 or newer installed, in the `desktop` folder:

    npm install
    npm run dist:win

The files appear in `desktop/dist`. The installer is unsigned, so Windows SmartScreen asks once for confirmation; a code-signing certificate of the institute would remove that prompt.
