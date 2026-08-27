# LinguaGate 🚪🗣️

> A CLI English learning tool that only replies when your grammar is correct.

Built with Node.js + [Antigravity CLI](https://antigravity.dev) as the AI backend — no API key required.

---

## How it works

You write in English. LinguaGate checks your grammar before doing anything else.

- ✅ **Correct** → the bot replies and your streak grows
- ❌ **Wrong** → it shows every error, the corrected sentence, and why — then asks you to try again

Every mistake is saved locally so the **Review** mode knows exactly what to drill you on.

---

## Modes

| Mode | Description |
|------|-------------|
| 💬 **Free Chat** | Write anything. Grammar gate active. |
| 🌍 **Translate** | Get a Spanish phrase, translate it to English. |
| ✏️ **Fill in the Blank** | Complete sentences with the right word. |
| 🔄 **Review My Mistakes** | Targeted exercises based on your most common errors. |

All modes support **beginner / intermediate / advanced** difficulty.

---

## Features

- 🔥 Streak counter with best streak tracking
- ✨ Word of the day on every startup
- 📊 Session summary (score, duration, top errors)
- 💾 Persistent error history in `data/history.json`

---

## Requirements

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io)
- [Antigravity CLI](https://antigravity.dev) (`agy`) installed and authenticated

---

## Setup

```bash
git clone https://github.com/Rainherz/LinguaGate.git
cd LinguaGate
pnpm install
pnpm start
```

---

## Project structure

```
src/
  index.js              # Entry point — mode selector + word of the day
  modes/
    chat.js             # Free chat mode
    translate.js        # ES → EN translation exercises
    fillblank.js        # Fill in the blank
    review.js           # Mistake review mode
  services/
    agy.js              # All agy subprocess calls
    history.js          # JSON persistence
    stats.js            # Session stats tracker
  ui/
    display.js          # Chalk UI helpers
data/                   # Auto-created on first run (gitignored)
  history.json
```

---

## License

MIT
