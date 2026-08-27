import { execSync } from 'node:child_process';

function callAgy(prompt) {
  const escaped = prompt.replace(/'/g, `'\\''`);
  const raw = execSync(`agy --print='${escaped}'`, {
    encoding: 'utf-8',
    timeout: 90_000,
  });
  return raw.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
}


const SPANISH_TOPICS = ["family","food and cooking","work and jobs","travel","weather","sports","technology","health","shopping","school and education","nature","music","movies","daily routines","feelings and emotions","animals","cities and places","money","hobbies","time and schedules"];
const FILLBLANK_TOPICS = ["prepositions of place","articles (a/an/the)","verb tenses","modal verbs","phrasal verbs","comparatives and superlatives","collocations","conjunctions","conditionals","relative clauses","passive voice","reported speech"];
function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function checkGrammar(text) {
  const prompt = `You are a strict English grammar checker.
Check if the following text has grammar or spelling errors.
Reply ONLY with a raw JSON object (no markdown, no code fences) with these exact fields:
  isCorrect: boolean — true only if the text has NO errors
  corrections: string[] — list of specific errors found (empty array if isCorrect is true)
  correctedText: string — the fixed version of the text
  explanation: string — brief explanation of the errors in simple English (empty string if isCorrect is true)

Text: "${text}"`;
  return JSON.parse(callAgy(prompt));
}

export function chatReply(userMessage) {
  const prompt = `You are a friendly, concise English conversation assistant.
The user has passed the grammar check. Reply naturally to their message.
Keep it conversational and short (1-3 sentences max).

User: ${userMessage}`;
  return callAgy(prompt);
}

export function getSpanishPhrase(difficulty) {
  const topic = randomPick(SPANISH_TOPICS);
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate a single Spanish sentence for an English translation exercise.
Topic: ${topic} (seed: ${seed})
Difficulty: ${difficulty}
- beginner: simple present tense, common vocabulary, short sentences
- intermediate: past/future tenses, idioms, compound sentences
- advanced: subjunctive, complex grammar, figurative language

Reply ONLY with a raw JSON object (no markdown, no code fences):
  spanish: string — the Spanish sentence
  english: string — the correct English translation
  hint: string — a short grammar hint (e.g. "Watch the tense")`;
  return JSON.parse(callAgy(prompt));
}

export function getFillBlank(difficulty) {
  const topic = randomPick(FILLBLANK_TOPICS);
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate an English fill-in-the-blank exercise.
Topic: ${topic} (seed: ${seed})
Difficulty: ${difficulty}
- beginner: articles, simple verbs, prepositions
- intermediate: phrasal verbs, conjunctions, modal verbs
- advanced: collocations, idiomatic expressions, nuanced vocabulary

Reply ONLY with a raw JSON object (no markdown, no code fences):
  sentence: string — an English sentence with exactly one "___" as the blank
  answer: string — the single correct word or short phrase that fills the blank
  hint: string — a grammar or vocabulary hint`;
  return JSON.parse(callAgy(prompt));
}

export function checkTranslation(original, userTranslation, correctTranslation) {
  const prompt = `You are an English translation evaluator.
Original Spanish: "${original}"
Correct English translation: "${correctTranslation}"
User translation: "${userTranslation}"

Evaluate the user translation. Minor wording differences are acceptable if the meaning is correct.
Reply ONLY with a raw JSON object (no markdown, no code fences):
  isCorrect: boolean — true if score >= 80
  feedback: string — specific feedback on what was right or wrong
  score: number — 0 to 100`;
  return JSON.parse(callAgy(prompt));
}

export function getWordOfDay() {
  const prompt = `Generate an interesting English word of the day for a Spanish speaker learning English.
Choose a useful, practical word (not too obscure).
Reply ONLY with a raw JSON object (no markdown, no code fences):
  word: string
  partOfSpeech: string — e.g. "noun", "verb", "adjective"
  definition: string — clear, simple definition
  example: string — a natural example sentence using the word`;
  return JSON.parse(callAgy(prompt));
}

export function getMistakeExercise(errorType) {
  const prompt = `Create a short English grammar exercise targeting this specific error type: "${errorType}".
Reply ONLY with a raw JSON object (no markdown, no code fences):
  exercise: string — an instruction and a sentence or question for the user to fix or answer
  answer: string — the correct answer
  explanation: string — brief explanation of the rule`;
  return JSON.parse(callAgy(prompt));
}
