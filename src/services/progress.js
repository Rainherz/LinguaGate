import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, writeJsonAtomic } from './storage.js';

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
  const data = readJson(PROGRESS_FILE, DEFAULT_PROGRESS);
  if (!Array.isArray(data.completedLessons)) data.completedLessons = [];
  if (!Array.isArray(data.history)) data.history = [];
  if (typeof data.xp !== 'number') data.xp = 0;
  return data;
}

export function saveProgress(data) {
  writeJsonAtomic(PROGRESS_FILE, data);
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

export function unlockUpToLevel(levelId, allLessons) {
  const progress = loadProgress();
  const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const targetIdx = levelOrder.indexOf(levelId);
  if (targetIdx <= 0) return progress;

  // Find all lessons before this target level
  for (const lesson of allLessons) {
    const lessonLevelIdx = levelOrder.indexOf(lesson.unitLevel);
    if (lessonLevelIdx < targetIdx && !progress.completedLessons.includes(lesson.id)) {
      progress.completedLessons.push(lesson.id);
      progress.xp += 50;
    }
  }

  progress.placedLevel = levelId;
  saveProgress(progress);
  return progress;
}

