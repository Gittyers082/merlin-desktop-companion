# Merlin 💀🔥

The skull of a long-dead archmage has haunted your desktop.

Merlin is a desktop companion for developers. He floats on your screen, vibes to your music, falls asleep when you leave, rages when your CPU is maxed, and talks back, powered by a local **Ollama** model by default or the **Claude API** if you connect it.

<!-- Replace with a real recording: docs/merlin-demo.gif -->

![Merlin summoning, vibing and talking](docs/merlin-demo.gif)

## Features

- 🔥 **Hand-built SVG animation**: a flowing flame crown generated in code, ten-plus moods, emote bubbles
- 🪄 **Summon and despawn** through a magic circle
- 🎵 **Vibes to music** playing anywhere on Windows (music apps only, or anything, your choice)
- 😴 **Falls asleep** when you're away, wakes up when you're back
- 😡 **Rages** when your CPU is maxed out
- 💬 **Click to chat**: replies stream into a speech bubble while his jaw moves
- 🖱️ **Drag him around or fling him**: he bounces off the screen edges and gets dizzy
- 👀 **Eyes follow your cursor**, and clicks pass through the empty space around him
- 🔊 **Sound effects** synthesized live with the Web Audio API (no audio files)
- ⚙️ **Settings window** for every sense, his brain, sounds and start-with-Windows

## Privacy

Every sense can be switched off in Settings. Music, idle time and CPU readings never leave your PC. The only thing sent anywhere is what you type to him, and only to the brain you picked: Ollama runs locally, Claude goes to Anthropic's API. Your Claude API key is stored in the Windows Credential Manager, never in a file, and the web page never sees it.

## Install

Download the latest installer from [Releases](../../releases), run it, and Merlin appears with a summoning ritual. Right-click him or his tray icon for Settings.

For chat you need either:

- **Ollama** (free, local): install from [ollama.com](https://ollama.com), then `ollama pull llama3.2`
- **Claude API** (pay as you go): paste your API key in Settings → Brain

## Tech stack

| Layer                   | Tech                                                            |
| ----------------------- | --------------------------------------------------------------- |
| App shell               | [Tauri 2](https://tauri.app) (Rust)                             |
| Rendering and animation | TypeScript, SVG, CSS, SVG `<animate>`                           |
| Senses                  | Windows media session API, `GetLastInputInfo`, `sysinfo`        |
| Brain                   | Ollama (local) or the Claude API, streamed over a Tauri channel |
| Secrets                 | Windows Credential Manager via `keyring`                        |

## Development

```bash
npm install
npm run tauri dev
```

In dev builds, click Merlin and press `1`–`8` to preview moods, or `9` to despawn and re-summon him.

```bash
npm run tauri build   # installer ends up in src-tauri/target/release/bundle/
```

## Status

v0.1.0, Windows only for now.
