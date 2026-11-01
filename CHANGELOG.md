# Changelog

## 2.3.4 — Restore original main menu

- Restored the previous main menu unchanged; boss art and boss health remain in the battle only.
- Kept the torn-paper red boss health bar in the in-game HUD.
- Kept the hand-inked Mecha redesign in the boss fight, not on the menu.

## 2.3.3 — Ink Arena concept art direction

- Rebuilt the main menu as a dark ink-covered notebook spread with an English title, stark white buttons, illustrated Mecha hero art and phase previews.
- Replaced the boss health bar with a torn-paper frame, red ink fill, phase cuts and a boss seal.
- Redrew Mecha as a black hand-inked monster with chalk-white scratches and phase-specific restrained color accents; removed polished metallic shading.

## 2.3.2 — Mecha visual overhaul

- Rebuilt the Mecha boss as a detailed armored machine with articulated limbs, animated joints, layered armor, reactor, visor and mechanical weaponry.
- Added recoil and cannon transformation animation, moving rocket exhaust, cyberpunk energy effects, pixel corruption and a redesigned Notepad finale.
- Preserved the five-phase fight sequence and existing attack logic.

## 2.3.1 — Mecha visibility fix

- Fixed the Mecha renderer leaking its canvas transform, which could shift the player and make them disappear during the boss fight.


## 2.3.0 — Mecha Finale

- Added the five-phase Mecha boss immediately after the Queen of the Swarm.
- Added the rolling spiked core, giant mech emergence, cone-beam fan, rocket salvos, cyberpunk and pixel phases, and the desktop/Notepad finale.
- Removed the King defeat question text and duplicate page-void rendering.
- Updated the boss phase preview and bestiary.


## 2.2.0 — Full Notebook & Effects Update

- Rebuilt the main menu as a full notebook spread: larger hand-inked title, stamped edition header, ruled paper, bold chapter buttons and tilted dossier cards.
- Added distinct defeat signatures for spiky, zipper, ranged, shield, ghost and blob enemies, alongside the existing flyer, bomber, splitter and brute effects.
- Added short-lived flower, crack, shard and layered shock effects with strict caps to keep busy waves responsive.
- Kept victory cleanup for live and baked ink stains, and bounded the visual-effect queues to prevent long-session buildup.
- Refined the notebook layout at desktop, tablet and phone breakpoints.

## 2.1.0 — Effects & Cleanup Update

- Added distinct death bursts for flying, bomber, splitter and brute enemies, with extra FX automatically reduced on lower quality settings.
- Added hard caps for shock rings and kill bursts to stop effects accumulating during long sessions.
- Clear both live and baked ink stains when a level ends, preventing old enemy trails from remaining on the victory page.
- Reworked update-status toast handling so a stalled GitHub check hides its "checking" message after 20 seconds.

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
