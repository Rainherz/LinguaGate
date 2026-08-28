# LinguaGate 🚪🗣️

> A CLI English learning platform powered by [Antigravity CLI](https://antigravity.dev) — no API key required.

---

## How it works

You write in English. LinguaGate checks your grammar before doing anything else.

- ✅ **Correct** → the bot replies, objectives complete, and your streak grows
- ❌ **Wrong** → it breaks down every error with grammar theory, suggestions, and tips

Every mistake is automatically converted into a **SuperMemo SM-2 Spaced Repetition (SRS)** flashcard.

---

## Modes

| Mode | Description |
|------|-------------|
| 🗺️ **Learning Path** | CEFR structured curriculum (A1 ➔ C1) with progressive lesson unlocks, micro-theory cheat sheets, and XP. |
| 🎧 **Listening & Dictation** | Audio listening lab: plays native English voice with speed controls (`[r]` 1.0x, `[s]` 0.7x, `[u]` 0.4x ultra slow) and phonetic IPA breakdowns. |
| ⚡ **Irregular Verbs Gym** | Master the 3 verb forms (*Infinitive ➔ Past Simple ➔ Past Participle*) categorized by CEFR level and phonetic patterns. |
| 🎭 **Roleplay Missions** | Real-world interactive scenarios (NYC Coffee Shop, Tech Standup, Airport Customs, Hotel) with live objective tracking. |
| 💬 **Phrasal Verbs & Slang** | Master native idiomatic expressions (Tech/Workplace, Daily Slang, Business) with situational quizzes. |
| ⚡ **Time Attack** | 60-second rapid fire grammar speed challenge with rankings. |
| 🧠 **Review Mistakes (SRS)** | SuperMemo SM-2 spaced repetition cards targeting grammar patterns due for retention. |
| 🎓 **Placement Test** | Adaptive diagnostic test that calibrates your CEFR level and auto-unlocks units. |
| 📦 **Export to Anki / Notebook**| Export all your SRS cards and irregular verbs to Anki `.csv` or personal Markdown study notebooks. |
| 💬 **Free Chat** | Open conversational practice with active grammar gate. |
| 🌍 **Translate** | Translate Spanish phrases to English with comprehensive grammar theory breakdowns. |
| ✏️ **Fill in the Blank** | Complete sentences with the correct word, tense, or preposition. |

---

## 🗺️ CEFR Curriculum

- **A1 (The Basics)**: Introductions, Articles & Nouns, Daily Routines, Time & Dates, Wh- Questions.
- **A2 (Getting Around)**: Past Simple (regular/irregular), Comparatives/Superlatives, Modals, Future Plans, Phrasal Verbs.
- **B1 (Speaking Your Mind)**: Present Perfect, Continuous Tenses, Zero/First Conditionals, Gerunds vs Infinitives, Linking Words.
- **B2 (Complex Ideas)**: Passive Voice, Second/Third Conditionals, Narrative Tenses, Relative Clauses, Past Modals.
- **C1 (Mastery)**: Mixed Conditionals, Inversion & Emphasis, Nominalisation, Advanced Connectors, Cleft Sentences.

---

## Features

- 🎧 **Native Audio Listening Lab**: Zero-config audio playback via `ffplay`/`mpg123` with chained digital audio filters for real 0.4x slow motion.
- ⚡ **Irregular Verbs Workout**: 50+ high-frequency verbs organized into phonetic pattern families (*i-a-u*, *ought/aught*, *o-o-en*).
- 📦 **One-Click Anki Sync**: Export all mistakes and verbs directly into Anki Mobile / Desktop (`export/anki_deck.csv`).
- 🎭 **Interactive Objective-Driven Roleplay**: Scenarios evaluate grammar + checklist goals in real time.
- 💬 **Idiomatic English Vault**: Phrasal verbs explained by real meaning vs literal traps.
- 🎓 **Adaptive Placement Test**: Calibrate directly to your real level (A2, B1, B2) without repeating what you already know.
- 🧠 **SuperMemo SM-2 SRS Engine**: Errors dynamically schedule intervals (1d ➔ 3d ➔ 7d ➔ 30d) with theory recaps and hints.
- ⚡ **Time Attack Mode**: Test grammar reflexes under pressure with speed ranks.
- 🗺️ **Duolingo-style Progression**: Unlock lessons in sequence as you pass exercises.
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
- `ffmpeg` / `ffplay` or `mpg123` (for native audio playback)

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
