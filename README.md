# LinguaGate 🚪🗣️

> A CLI English learning tool that only replies when your grammar is correct.

Built with Node.js + [Antigravity CLI](https://antigravity.dev) as the AI backend — no API key required.

---

## How it works

You write in English. LinguaGate checks your grammar before doing anything else.

- ✅ **Correct** → the bot replies and your streak grows
- ❌ **Wrong** → it shows every error, the corrected sentence, full grammar theory, and why — then asks you to try again

Every mistake is saved locally so the **Review** mode knows exactly what to drill you on.

---

## Modes

| Mode | Description |
|------|-------------|
| 🗺️ **Learning Path** | CEFR structured curriculum (A1 ➔ C1) with progressive lesson unlocks & XP. |
| 💬 **Free Chat** | Write anything. Grammar gate active. |
| 🌍 **Translate** | Get a Spanish phrase, translate it to English with full grammar theory breakdowns. |
| ✏️ **Fill in the Blank** | Complete sentences with the right word or preposition. |
| 🔄 **Review My Mistakes** | Targeted exercises based on your personal most common errors. |

All independent modes support **beginner / intermediate / advanced** difficulty.

---

## 🗺️ Curriculum (CEFR Standard)

The Learning Path is structured into 5 progressive levels:
- **A1 (The Basics)**: Introductions, Articles, Daily Routines, Prepositions of Time, Wh- Questions.
- **A2 (Getting Around)**: Past Simple (regular/irregular), Comparatives/Superlatives, Modals, Future Plans, Phrasal Verbs.
- **B1 (Speaking Your Mind)**: Present Perfect, Continuous Tenses, Zero/First Conditionals, Gerunds vs Infinitives, Linking Words.
- **B2 (Complex Ideas)**: Passive Voice, Second/Third Conditionals, Narrative Tenses, Relative Clauses, Past Modals.
- **C1 (Mastery)**: Mixed Conditionals, Inversion & Emphasis, Nominalisation, Advanced Connectors, Cleft Sentences.

---

## Features

- 🗺️ **Duolingo-style Progression**: Unlock lessons in sequence as you pass exercises.
- ⚡ **XP & Leveling**: Earn experience points per completed lesson.
- 🔥 **Streak Counter**: Track consecutive correct answers and personal records.
- 📖 **Grammar Theory Engine**: Deep explanations of grammar rules on mistake.
- ✨ **Word of the Day**: High-frequency vocabulary presented on startup.
- 📊 **Session Summary**: Score, duration, accuracy %, and top mistake categories.
- 💾 **Persistent Progress**: Saved in `data/progress.json` and `data/history.json`.

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

## Project Structure

```
src/
  index.js              # Entry point — mode selector & progress summary
  curriculum.json       # CEFR curriculum syllabus (A1 to C1)
  modes/
    path.js             # CEFR Learning Path runner & ASCII map
    chat.js             # Free chat mode
    translate.js        # ES → EN translation exercises
    fillblank.js        # Fill in the blank
    review.js           # Mistake review mode
  services/
    agy.js              # agy AI subprocess calls & lesson generators
    history.js          # Error tracking & streak persistence
    progress.js         # XP & lesson unlock persistence
    stats.js            # Live session analytics
  ui/
    display.js          # UI display helpers
data/                   # User data (gitignored)
  history.json
  progress.json
```

---

## License

MIT
