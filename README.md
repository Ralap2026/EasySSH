# EasySSH

EasySSH is a desktop SSH client built with Electron, React, TypeScript, and Vite.

The project is focused on a practical Windows workflow:

- manage multiple SSH hosts in a local database
- open concurrent tabbed terminal sessions
- upload files to remote servers
- save and reuse shell snippets
- switch between light and dark themes
- switch between Chinese and English
- build a portable Windows executable

The packaged Windows product name is `EasySSH`.

## Product Overview

EasySSH is not a browser-based terminal. It is a native desktop application that packages:

- an Electron main process for native integration
- a React renderer for the application UI
- `ssh2` for SSH and SFTP
- `xterm.js` for terminal rendering
- `better-sqlite3` for local persistence

The application is designed around a local-first operator workflow. Host definitions, settings, scripts, and the latest detected sing-box URL are stored on the local machine.

## Main Features

### Host management

- Add, edit, and delete hosts
- Batch import hosts from common SSH text formats
- Persist hosts in SQLite
- Show `created_at` and `last_used_at` timestamps on host cards

### Multi-session terminal

- Open multiple SSH sessions in tabs
- Reconnect, disconnect, clone, close, and upload via the tab context menu
- Auto-reconnect when the session has been dropped and the user presses `Enter`
- Show the connected `host:port` in the terminal header
- Show lightweight server stats in the header:
  - CPU
  - memory
  - disk

### Clipboard behavior

- Copy terminal selection immediately after text selection changes
- Right-click inside the terminal to paste from the system clipboard

### File upload

- Select one or more local files with the native file picker
- Upload to a target remote directory through SFTP
- Show upload progress
- Refresh the remote directory listing in the terminal after upload

### Script library

- Save reusable shell snippets
- Select an active session and send a saved script to that terminal

### Sing-box workflow helpers

- Built-in `Install sing-box` terminal action
- Built-in `Uninstall Service` terminal action
- Detect the latest sing-box URL from terminal output
- Save the latest detected URL locally
- Open a modal to display and copy the latest saved URL

### Appearance and localization

- Light and dark theme support
- Light theme is the default
- System language detection on startup
- Chinese is used only when the operating system locale is Chinese
- English is used for all non-Chinese system locales
- Manual language switching is also available in the sidebar

### Embedded remote panel

- The sidebar includes a remote embedded page area
- The application checks whether the target URL is reachable and HTML-like before loading it

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- xterm.js
- ssh2
- better-sqlite3
- electron-builder

## Project Structure

```text
WebSSH_client/
  electron/
    db.ts
    ipc.ts
    main.ts
    preload.ts
    sshHandler.ts
  resources/
    singbox/
      install.sh
      main.sh
  scripts/
    postbuild-win-metadata.mjs
  src/
    components/
    hooks/
    pages/
    App.tsx
    i18n.tsx
    main.tsx
  public/
  package.json
  vite.config.ts
  webssh.ico
  rocket.png
```

## Architecture

### Renderer

The renderer is a React application.

Important areas:

- `src/pages/Servers.tsx`
  - host list and host card workflow
- `src/components/TerminalView.tsx`
  - xterm integration
  - session lifecycle
  - quick actions
  - clipboard behavior
  - latest sing-box URL detection
- `src/components/UploadFileModal.tsx`
  - SFTP upload workflow
- `src/pages/Scripts.tsx`
  - saved script management and deployment
- `src/pages/Settings.tsx`
  - proxy and auto-run settings
- `src/i18n.tsx`
  - Chinese and English strings
  - OS locale detection

### Main process

The Electron main process handles:

- window creation
- clipboard access
- native file pickers
- URL availability checks for the embedded page
- IPC registration
- SSH and SFTP operations

Important files:

- `electron/main.ts`
- `electron/ipc.ts`
- `electron/sshHandler.ts`
- `electron/preload.ts`

### Local database

The application uses SQLite through `better-sqlite3`.

The current schema includes:

- `servers`
- `logs`
- `scripts`
- `settings`

The database is stored under the Electron user data directory:

- `app.getPath("userData")/webssh_data/database.sqlite3`

## SSH and SFTP Implementation

SSH is implemented with `ssh2`.

Supported connection inputs:

- password authentication
- private key authentication
- SOCKS5 proxy relay for SSH connections

SFTP is used for:

- single-file upload
- multi-file upload
- bundled sing-box installer asset upload

## Settings

Current persisted settings include:

- `socksProxy`
- `autoExecution`
- `latest_singbox_url`
- `latest_singbox_url_saved_at`

## Build and Packaging

The project is configured to build a Windows portable application with `electron-builder`.

Current package settings include:

- product name: `EasySSH`
- build version: `3.12.88.120`
- Windows target: `portable`
- icon: `webssh.ico`
- output artifact name: `webssh.exe`

After packaging, the unpacked executable is typically:

- `dist/win-unpacked/EasySSH.exe`

The configured portable artifact is:

- `dist/webssh.exe`

The postbuild script updates Windows version metadata in the produced executable.

## Development

### Requirements

- Node.js
- npm
- Windows is the primary target environment

### Install dependencies

```bash
npm install
```

### Run in development mode

```bash
npm run dev
```

This starts the Vite-based Electron development workflow.

### Lint

```bash
npm run lint
```

### Preview the renderer

```bash
npm run preview
```

### Build the portable Windows executable

```bash
npm run build
```

This build runs:

1. TypeScript project build
2. Vite renderer build
3. Electron packaging with `electron-builder`
4. Windows executable metadata patching

## Branding

The project currently uses:

- application name in UI: `EasySSH`
- application icon assets:
  - `rocket.png`
  - `webssh.ico`

## Notes About Naming

The repository folder is still named `WebSSH_client`, and some internal file names still use the older `webssh` naming.

However, the actual product name and packaged desktop application name are:

- `EasySSH`

## Known Limitations

- The current build target is Windows portable packaging
- The project is not documented for macOS or Linux packaging workflows
- Some internal identifiers still use the old `webssh` name
- The packaged artifact name is still configured as `webssh.exe`, even though the product name is `EasySSH`
- Some local test artifacts and temporary screenshots exist in the repository root and should not be treated as source files

## Recommended Cleanup Areas

The project works, but these areas are good candidates for future cleanup:

- unify naming from `webssh` to `EasySSH`
- remove temporary screenshots and local test output from the repository root
- expand automated testing
- document the exact supported batch import formats with examples
- separate product packaging details from development configuration more clearly

## License

MIT license file is currently included in this repository.

If this project is going to be distributed publicly, add an explicit license file before publication.
