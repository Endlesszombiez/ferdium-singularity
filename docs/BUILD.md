# Building Ferdium from Source

This guide walks you through building Ferdium into installable packages for **macOS** (including Apple Silicon), **Windows**, and **Linux**.

## Table of Contents

- [Prerequisites](#prerequisites)
  - [All Platforms](#all-platforms)
  - [macOS](#macos-prerequisites)
  - [Windows](#windows-prerequisites)
  - [Linux](#linux-prerequisites)
- [Clone the Repository](#clone-the-repository)
- [Building](#building)
  - [macOS Apple Silicon (M1/M2/M3) — Recommended](#macos-apple-silicon-m1m2m3--recommended)
  - [macOS Intel (x64)](#macos-intel-x64)
  - [Windows](#windows)
  - [Linux](#linux)
- [Build Outputs](#build-outputs)
- [Build Options](#build-options)
- [Docker Build (Linux only)](#docker-build-linux-only)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### All Platforms

The following tools must be installed before building on any platform. Version numbers are **exact** — the build scripts enforce these versions.

| Tool | Required Version | Notes |
|------|-----------------|-------|
| Node.js | `22.18.0` | Use [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://github.com/asdf-vm/asdf) to manage versions |
| pnpm | `10.14.0` | Installed automatically by the build scripts if the wrong version is present |
| Git | `2.23.0+` | Any recent version works; 2.23.0 is known to work |

**Install the exact Node.js version:**

```bash
# Using nvm (recommended for macOS/Linux)
nvm install 22.18.0
nvm use 22.18.0

# Verify
node -v   # should print: v22.18.0
```

**Install pnpm** (the build scripts will auto-install the correct version, but you can also install it manually):

```bash
npm install -g pnpm@10.14.0

# Verify
pnpm --version   # should print: 10.14.0
```

---

### macOS Prerequisites

1. **Xcode Command Line Tools** — required for native module compilation:
   ```bash
   xcode-select --install
   ```
   If you see `gyp: No Xcode or CLT version detected` during the build, follow [this guide](https://medium.com/flawless-app-stories/gyp-no-xcode-or-clt-version-detected-macos-catalina-anansewaa-38b536389e8d).

2. **No additional system packages are needed** for a basic build. Code signing and notarization credentials are only required for distribution (see [Code Signing](#code-signing-macos)).

---

### Windows Prerequisites

1. **Microsoft Visual Studio Build Tools** — required for native module compilation:
   - Download [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
   - During installation, select the **Desktop development with C++** workload
   - Make sure to include the **Windows 10 SDK** component
   - Supported versions: **2019** or **2022**

2. **PowerShell 5.1+** — the build script is a `.ps1` file (included in Windows 10/11).

---

### Linux Prerequisites

**Debian / Ubuntu:**
```bash
sudo apt-get update -y
sudo apt-get install --no-install-recommends -y rpm ruby rubygems
sudo gem install fpm --no-document
```

**Fedora:**
```bash
sudo dnf install libX11-devel libXext-devel libXScrnSaver-devel libxkbfile-devel rpm
```

---

## Clone the Repository

The repository uses a Git submodule for recipes. Make sure to check it out along with the main repo:

```bash
git clone https://github.com/ferdium/ferdium-app.git
cd ferdium-app
git submodule update --init --recursive --remote --rebase --force
```

> **Important:** The `git submodule update` command is required. Without it the build will fail because the `recipes/` folder will be missing.

---

## Building

All build scripts live in the `scripts/` folder. They handle dependency installation, linting, testing, and packaging in one step.

---

### macOS Apple Silicon (M1/M2/M3) — Recommended

Apple Silicon Macs (arm64) are fully supported and produce native ARM64 binaries.

**1. Run the build script:**

```bash
./scripts/build-unix.sh
```

The script automatically detects your CPU architecture (`uname -m`) and sets `TARGET_ARCH=arm64` when running on Apple Silicon. It will:
- Verify Node.js and pnpm versions
- Install all dependencies
- Build and package the recipes
- Run linting and tests
- Produce an arm64 `.app` bundle in the `out/` folder

**2. Build installable DMG and ZIP packages:**

To build distribution-ready DMG and ZIP files (instead of just the app directory), run:

```bash
pnpm exec preval-build-info-cli
node esbuild.mjs
pnpm exec electron-builder --mac dmg zip --arm64 --publish never
```

Output files will appear in the `out/` folder:
- `Ferdium-mac-<version>-arm64.dmg` — drag-and-drop installer
- `Ferdium-mac-bundle-<version>-arm64.zip` — ZIP archive of the app

> **Tip:** This is the same command used by the [macOS Installer GitHub Actions workflow](../.github/workflows/macos-installer.yml).

#### Code Signing (macOS)

Code signing is **not required** for local builds and personal use. If you want to self-sign (without an Apple Developer certificate) to remove the macOS security warning, run:

```bash
codesign --deep --force --verbose --sign - node_modules/electron/dist/Electron.app
```

For distribution builds requiring full notarization, you need an Apple Developer account and the following environment variables set:
- `APPLEID` — your Apple ID email
- `APPLEID_PASSWORD` — an [app-specific password](https://support.apple.com/en-us/102654) for your Apple ID
- `APPLE_TEAM_ID` — your Apple Developer Team ID
- `CSC_LINK` — path or base64-encoded `.p12` certificate
- `CSC_KEY_PASSWORD` — certificate password

---

### macOS Intel (x64)

Building on an Intel Mac follows the same steps. The build script detects `x86_64` and sets `TARGET_ARCH=x64` automatically.

**Run the build script:**

```bash
./scripts/build-unix.sh
```

**Build installable packages:**

```bash
pnpm exec preval-build-info-cli
node esbuild.mjs
pnpm exec electron-builder --mac dmg zip --x64 --publish never
```

Output files in `out/`:
- `Ferdium-mac-<version>-x64.dmg`
- `Ferdium-mac-bundle-<version>-x64.zip`

---

### Windows

The Windows build script is a PowerShell script that works on x64 and ARM64 Windows machines. Open a **PowerShell** terminal (not Command Prompt) and run:

```powershell
.\scripts\build-windows.ps1
```

The script will:
- Check for the required Node.js version
- Verify Visual Studio Build Tools are installed
- Install/update pnpm to the correct version
- Install all dependencies
- Build and package the recipes
- Run linting and tests
- Produce an x64 (or ARM64) app directory in `out/`

**Build installable packages:**

To produce NSIS installers and portable executables:

```powershell
# x64 (most common)
pnpm build -- --x64 --win nsis portable

# x86 (32-bit)
pnpm build -- --ia32 --win nsis portable

# ARM64
pnpm build -- --arm64 --win nsis portable
```

Output files in `out/`:
- `Ferdium-win-AutoSetup-<version>-x64.exe` — NSIS installer
- `Ferdium-win-Portable-<version>-x64.exe` — portable executable

---

### Linux

Run the build script from the repository root:

```bash
./scripts/build-unix.sh
```

The script detects your CPU (x64 or arm64) and builds accordingly.

**Build specific package formats:**

```bash
# AppImage (universal, runs without installation)
pnpm build -- --x64 --linux AppImage

# Debian/Ubuntu .deb package
pnpm build -- --x64 --linux deb

# Fedora/RHEL .rpm package
pnpm build -- --x64 --linux rpm

# Compressed tar.gz archive
pnpm build -- --x64 --linux tar.gz

# All formats at once
pnpm build -- --x64 --linux AppImage deb rpm tar.gz
```

**ARM64 Linux:**

```bash
pnpm build -- --arm64 --linux AppImage deb rpm tar.gz
```

Output files in `out/`:
- `Ferdium-linux-<version>.AppImage`
- `Ferdium-linux-<version>-amd64.deb`
- `Ferdium-linux-<version>-x64.rpm`
- `Ferdium-linux-<version>-x64.tar.gz`

---

## Build Outputs

All built artifacts are placed in the `out/` folder at the root of the repository.

| Platform | Architecture | File(s) |
|----------|-------------|---------|
| macOS | arm64 (Apple Silicon) | `.dmg`, `.zip` |
| macOS | x64 (Intel) | `.dmg`, `.zip` |
| Windows | x64 | `-AutoSetup-...-x64.exe`, `-Portable-...-x64.exe` |
| Windows | ia32 | `-AutoSetup-...-ia32.exe`, `-Portable-...-ia32.exe` |
| Windows | arm64 | `-AutoSetup-...-arm64.exe`, `-Portable-...-arm64.exe` |
| Linux | x64 | `.AppImage`, `.deb`, `.rpm`, `.tar.gz` |
| Linux | arm64 | `.deb`, `.rpm`, `.tar.gz` |

---

## Build Options

### Skip code quality checks (faster local builds)

The build scripts run `pnpm prepare-code`, `pnpm lint`, and `pnpm test` before packaging. For a faster local build (not recommended for PRs), you can run the packaging step directly:

```bash
# macOS arm64 — package only
pnpm exec preval-build-info-cli && node esbuild.mjs && electron-builder --mac --arm64 --publish never

# macOS x64 — package only
pnpm exec preval-build-info-cli && node esbuild.mjs && electron-builder --mac --x64 --publish never

# Windows x64 — package only
pnpm exec preval-build-info-cli && node esbuild.mjs && electron-builder --win --x64 --publish never

# Linux x64 — package only
pnpm exec preval-build-info-cli && node esbuild.mjs && electron-builder --linux --x64 --publish never
```

### Clean build

If you are upgrading Node.js or switching branches, run a clean build to remove all cached modules:

```bash
# macOS / Linux
CLEAN=true ./scripts/build-unix.sh

# Windows
$env:CLEAN = "true"; .\scripts\build-windows.ps1
```

---

## Docker Build (Linux only)

If you prefer not to install system dependencies directly, you can build Linux packages inside Docker:

**Build the image:**

```bash
docker build -t ferdium-package-$(uname -m) .
```

**Extract the built artifacts:**

```bash
DATE=$(date +"%Y-%b-%d-%H-%M")
mkdir -p ~/Downloads/$DATE

docker run \
  -e GIT_SHA=$(git rev-parse --short HEAD) \
  -v ~/Downloads/$DATE:/ferdium-out \
  -it ferdium-package-$(uname -m) sh

# Inside the container, copy artifacts to the mounted folder:
mv /ferdium/Ferdium-*.AppImage /ferdium-out/Ferdium-$GIT_SHA.AppImage
mv /ferdium/ferdium-*.tar.gz   /ferdium-out/Ferdium-$GIT_SHA.tar.gz
mv /ferdium/ferdium-*.x86_64.rpm /ferdium-out/Ferdium-x86_64-$GIT_SHA.rpm
mv /ferdium/ferdium_*_amd64.deb  /ferdium-out/Ferdium-amd64-$GIT_SHA.deb
```

> **Note:** Docker builds are not officially supported as a first-class citizen and may lag behind the native build process.

---

## Troubleshooting

### `gyp: No Xcode or CLT version detected` (macOS)

The Xcode Command Line Tools are not installed or are outdated. Run:

```bash
xcode-select --install
# If already installed, reset and reinstall:
sudo xcode-select --reset
xcode-select --install
```

For more details, see [this guide](https://medium.com/flawless-app-stories/gyp-no-xcode-or-clt-version-detected-macos-catalina-anansewaa-38b536389e8d).

---

### Wrong Node.js or pnpm version

The build scripts will fail if you are not using the exact required versions. Use a version manager like [nvm](https://github.com/nvm-sh/nvm) or [asdf](https://github.com/asdf-vm/asdf) to switch Node.js versions:

```bash
nvm use        # reads .nvmrc and switches to 22.18.0
nvm install    # installs if not already available
```

---

### `recipes` folder missing or submodule not initialized

```bash
git submodule update --init --recursive --remote --rebase --force
```

---

### Dependency errors after switching branches or upgrading Node.js

Run a clean build to remove stale cached modules:

```bash
CLEAN=true ./scripts/build-unix.sh
```

---

### Windows: Visual Studio Build Tools not detected

Make sure:
1. Visual Studio Build Tools **2019** or **2022** are installed
2. The **Desktop development with C++** workload is selected
3. The **Windows 10 SDK** component is included

You can verify the installation by running the build script — it will print a diagnostic message if the tools are missing or wrong version.

---

### macOS: App can't be opened because Apple cannot check it for malicious software

For personal/development builds that are not notarized, you can self-sign to suppress the warning:

```bash
codesign --deep --force --verbose --sign - node_modules/electron/dist/Electron.app
```

Alternatively, right-click the app in Finder and choose **Open** the first time to bypass Gatekeeper.
