# LinguaGate 🚪🗣️

> A CLI English learning tool that only replies when your grammar is correct.

Built with Node.js + [Antigravity CLI](https://antigravity.dev) as the AI backend — no API key required.

---

## How it works

You write in English. LinguaGate checks your grammar before doing anything else.

- ✅ **Correct** → the bot replies and your streak grows
- ❌ **Wrong** → it shows every error, the corrected sentence, full grammar theory, and why — then asks you to try again

Every mistake is converted into a **Spaced Repetition (SRS)** flashcard so the review system knows exactly when to test you again.

---

## Modes

| Mode | Description |
|------|-------------|
| 🗺️ **Learning Path** | CEFR structured curriculum (A1 ➔ C1) with progressive lesson unlocks & XP. |
| ⚡ **Time Attack** | 60-second rapid fire grammar speed challenge with rankings. |
| 🧠 **Review Mistakes (SRS)** | Spaced Repetition (SM-2 algorithm) testing cards due for retention. |
| 🎓 **Placement Test** | Adaptive diagnostic test that calibrates your CEFR level and auto-unlocks units. |
| 💬 **Free Chat** | Open conversational practice with active grammar gate. |
| 🌍 **Translate** | Translate Spanish phrases to English with comprehensive grammar theory breakdowns. |
| ✏️ **Fill in the Blank** | Complete sentences with the correct word, tense, or preposition. |

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

- 🎓 **Adaptive Placement Test**: Calibrate directly to A2, B1, or B2 without repeating what you already know.
- 🧠 **SuperMemo SM-2 SRS Engine**: Errors dynamically schedule intervals (1d ➔ 3d ➔ 7d ➔ 30d).
- ⚡ **Time Attack Mode**: Test grammar reflexes under pressure with speed ranks.
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

## License

MIT
