import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHistory, getCardKind } from './history.js';
import { loadProgress } from './progress.js';
import { loadVerbs } from './verbs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = join(__dirname, '../../export');

function ensureExportDir() {
  if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Exports all SRS flashcards and errors to an Anki-compatible CSV file.
 * Format: "Front (HTML/Text)","Back (HTML/Text)","Tags"
 */

/**
 * Renders one SRS card for export.
 *
 * Pronunciation cards store `target` / `lastSpoken`; grammar cards store
 * `lastMistake`. Reading only the latter produced pronunciation cards with an
 * empty back — a deck of dead cards.
 * @param {{ kind?: string, rule?: string, target?: string, lastSpoken?: string, confidence?: number|null, lastMistake?: { original?: string, corrected?: string } }} card
 * @returns {{ front: string, back: string, tags: string }}
 */
function renderCard(card) {
  if (getCardKind(card) === 'pronunciation') {
    return {
      front: `<b>Say this out loud:</b> ${card.target}` +
        (card.lastSpoken ? `<br><i>Last time it came out as: ${card.lastSpoken}</i>` : ''),
      back: `<b>Target:</b> ${card.target}` +
        (card.lastSpoken ? `<br><b>You said:</b> ${card.lastSpoken}` : '') +
        (typeof card.confidence === 'number'
          ? `<br><b>Recognizer confidence:</b> ${card.confidence.toFixed(2)}`
          : ''),
      tags: 'LinguaGate::Pronunciation SRS'
    };
  }

  return {
    front: `<b>Rule Check:</b> ${card.rule}<br><i>Last context: ${card.lastMistake?.original || 'Practice'}</i>`,
    back: `<b>Correct:</b> ${card.lastMistake?.corrected || ''}<br><b>Rule:</b> ${card.rule}`,
    tags: 'LinguaGate::Grammar SRS'
  };
}

/**
 * @param {{ kind?: string, target?: string, lastSpoken?: string, lastMistake?: { original?: string, corrected?: string } }} card
 * @returns {string} the "wrong -> right" context column
 */
function cardContext(card) {
  return getCardKind(card) === 'pronunciation'
    ? `\`${card.lastSpoken || ''}\` ➔ \`${card.target || ''}\``
    : `\`${card.lastMistake?.original || ''}\` ➔ \`${card.lastMistake?.corrected || ''}\``;
}

export function exportToAnkiCsv() {
  ensureExportDir();
  const history = loadHistory();
  const srsCards = Object.values(history.srsCards || {});

  let csvContent = '#separator:Comma\n#html:true\n#tags column:3\n';
  csvContent += '"Front","Back","Tags"\n';

  // 1. Export SRS Cards
  for (const card of srsCards) {
    const { front, back, tags } = renderCard(card);
    csvContent += `"${escapeCsv(front)}","${escapeCsv(back)}","${tags}"\n`;
  }

  // 2. Export Irregular Verbs
  const verbs = loadVerbs();
  for (const v of verbs) {
    const front = `<b>Conjugate verb:</b> <i>${v.infinitive}</i> (${v.spanish})<br>Give Past Simple (V2) and Past Participle (V3)`;
    const back = `<b>Past Simple (V2):</b> ${v.past}<br><b>Past Participle (V3):</b> ${v.participle}<br><b>Pattern:</b> ${v.pattern}`;
    const tags = `LinguaGate::Verbs::${v.level}`;

    csvContent += `"${escapeCsv(front)}","${escapeCsv(back)}","${tags}"\n`;
  }

  const filePath = join(EXPORT_DIR, 'anki_deck.csv');
  writeFileSync(filePath, csvContent, 'utf-8');
  return { filePath, count: srsCards.length + verbs.length };
}

/**
 * Exports a beautiful personal grammar notebook in Markdown format.
 */
export function exportToMarkdownNotebook() {
  ensureExportDir();
  const history = loadHistory();
  const progress = loadProgress();
  const verbs = loadVerbs();

  let md = `# 📖 LinguaGate Personal Study Notebook\n\n`;
  md += `> Generated on ${new Date().toLocaleDateString()} — Current XP: **${progress.xp} ⚡** | Best Streak: **${history.bestStreak} 🔥**\n\n`;

  md += `## 🗺️ Completed Curriculum Lessons\n\n`;
  if (progress.completedLessons?.length > 0) {
    md += progress.completedLessons.map((l) => `- [x] Lesson **${l}**`).join('\n') + '\n\n';
  } else {
    md += `*No lessons completed yet. Start in Learning Path!*\n\n`;
  }

  md += `## 🧠 Spaced Repetition (SRS) Flashcards Due\n\n`;
  const cards = Object.values(history.srsCards || {});
  if (cards.length > 0) {
    md += `| Rule | Frequency | Interval (Days) | Last Mistake Context |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    cards.forEach((c) => {
      md += `| **${c.rule}** | ${c.count || 1}x | ${c.interval || 1}d | ${cardContext(c)} |\n`;
    });
    md += '\n';
  } else {
    md += `*No mistake cards registered yet. Great accuracy!*\n\n`;
  }

  md += `## ⚡ Irregular Verbs Quick Reference Guide\n\n`;
  md += `| Level | Infinitive (V1) | Past Simple (V2) | Past Participle (V3) | Spanish | Pattern |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  verbs.forEach((v) => {
    md += `| ${v.level} | **${v.infinitive}** | ${v.past} | ${v.participle} | ${v.spanish} | \`${v.pattern}\` |\n`;
  });

  const filePath = join(EXPORT_DIR, 'my_grammar_notebook.md');
  writeFileSync(filePath, md, 'utf-8');
  return { filePath };
}

function escapeCsv(str) {
  return (str || '').replace(/"/g, '""');
}
