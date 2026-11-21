# Merlin 💀🔥

The skull of a long-dead archmage has haunted your desktop.

Merlin is a desktop companion for developers. He floats on your screen, vibes to your music, judges your code, and talks back — powered by a local **Ollama** model by default, or the **Claude API** if you connect it.

## Features (planned for v1)

- 🔥 Hand-animated SVG skull with flowing cyan fire
- 🪄 Summon / despawn with a magic circle
- 🎵 Vibes to whatever's playing on your PC
- 💬 Click him to chat (Ollama by default, Claude optional)
- 🖱️ Drag him around, or fling him across the screen
- 😴 Falls asleep when you're idle, rages when your CPU is maxed
- 🔒 Every data source he can see has its own on/off toggle

## Tech stack

- [Tauri 2](https://tauri.app) (Rust) — window, system access, AI calls
- TypeScript + SVG/CSS — rendering and animation
- Ollama / Claude API — his brain

## Development

```bash
npm install
npm run tauri dev
```

## Status

🚧 Early development.