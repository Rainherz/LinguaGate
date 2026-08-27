import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const PROGRESS_FILE = join(DATA_DIR, 'progress.json');

const DEFAULT_PROGRESS = {
  xp: 0,
  completedLessons: [], // ['A1.1', 'A1.2']
  currentLessonId: 'A1.1',
  history: []
};

export function loadProgress() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(PROGRESS_FILE)) {
    writeFileSync(PROGRESS_FILE, JSON.stringify(DEFAULT_PROGRESS, null, 2));
    return structuredClone(DEFAULT_PROGRESS);
  }
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return structuredClone(DEFAULT_PROGRESS);
  }
}

export function saveProgress(data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

export function completeLesson(lessonId, earnedXp = 50) {
  const progress = loadProgress();
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
  }
  progress.xp += earnedXp;
  progress.history.push({
    lessonId,
    timestamp: new Date().toISOString(),
    earnedXp
  });
  saveProgress(progress);
  return progress;
}

export function isLessonUnlocked(lessonId, allLessons) {
  const progress = loadProgress();
  const index = allLessons.findIndex((l) => l.id === lessonId);
  if (index === 0) return true; // First lesson always unlocked
  const prevLesson = allLessons[index - 1];
  return progress.completedLessons.includes(prevLesson.id);
}
