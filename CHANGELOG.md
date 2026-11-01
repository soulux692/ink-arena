# Changelog

## 2.0.0 — Global Notebook Update

- Increased the health of the first three campaign bosses by 50%: Tentacle Lord 135 HP, Swarm Queen 195 HP, Ink Octopus 263 HP.
- Added a new boss destruction sequence with an ink implosion, expanding shock rings, scattered paper fragments and fresh ink splashes.
- Refreshed the main menu with a ruled notebook page, edition masthead and revised paper-like framing.

## 1.3.3

- Update checks now time out after 20 seconds if GitHub Releases does not respond, instead of leaving the main-menu button or startup screen stuck indefinitely.
- The timeout reports a connection error and allows the player to continue using the installed version.

## 1.3.2

- Startup now waits for the update check and clearly reports when the installed version is current.
- Available updates show the detected version and real download progress before automatic installation and restart.
- Main-menu UPDATE button now checks GitHub Releases instead of opening the disabled ZIP import flow.
- Co-op player movement is interpolated every rendered frame to reduce visible stutter.

# Changelog

## 1.3.1
- Disabled ZIP update imports that extracted archives and could execute bundled PowerShell or BAT scripts.
- Kept updates on the GitHub Releases auto-updater channel.

## 1.3.0
- Added automatic discovery of co-op rooms on the same local Wi-Fi network for Windows desktop players.
- Added direct TCP gameplay transport over the local network, with the existing online connection as fallback.
- Enabled automatic GitHub Releases update downloads, silent installation, and application restart.
