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
  const prompt = `You are an English grammar teacher evaluating a translation.
Original Spanish: "${original}"
Correct English translation: "${correctTranslation}"
User translation: "${userTranslation}"

Evaluate the user translation. Minor wording differences are acceptable if the meaning is correct.
For every error found, explain the GRAMMAR THEORY behind it — not just what is wrong, but WHY it is wrong.
Include the rule name, how it works, and a second example to reinforce it.

Reply ONLY with a raw JSON object (no markdown, no code fences):
  isCorrect: boolean — true if score >= 80
  score: number — 0 to 100
  feedback: string — one sentence summary of the overall quality
  errors: Array<{ wrong: string, correct: string, rule: string, theory: string, example: string }>
    wrong: the exact word or phrase the user wrote
    correct: what it should be
    rule: the grammar rule name (e.g. "Third-person singular present tense")
    theory: 2-3 sentence explanation of the rule from scratch, as if the user knows nothing
    example: a second example sentence demonstrating the correct rule`;
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
  const prompt = `You are a personalized English grammar tutor helping a Spanish speaker review their past mistake.
Error/Rule: "${errorType}"

Create a targeted review flashcard.
Provide:
1. ruleRecap: 1-2 sentence crystal clear explanation in Spanish of what this rule is and how to fix it.
2. tip: a quick actionable rule of thumb in Spanish.
3. exercise: clear exercise instruction + the sentence to fix or complete.
4. hint: a subtle clue pointing to where the error is.
5. answer: the exact correct sentence or word.
6. explanation: why this answer is correct in English.

Reply ONLY with a raw JSON object (no markdown, no code fences):
  ruleRecap: string
  tip: string
  exercise: string
  hint: string
  answer: string
  explanation: string`;
  return JSON.parse(callAgy(prompt));
}


export function getLessonPhrase(lesson) {
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate a single Spanish sentence for an English translation exercise specifically for this lesson:
Lesson Title: ${lesson.title}
Target Topic: ${lesson.topic}
Grammar Focus: ${lesson.grammar}
Seed: ${seed}

Make sure the sentence tests the exact grammar focus and topic above.
Reply ONLY with a raw JSON object (no markdown, no code fences):
  spanish: string — the Spanish sentence
  english: string — the correct English translation
  hint: string — a helpful grammar tip focused on ${lesson.grammar}`;
  return JSON.parse(callAgy(prompt));
}

export function getLessonFillBlank(lesson) {
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate an English fill-in-the-blank exercise for this lesson:
Lesson Title: ${lesson.title}
Target Topic: ${lesson.topic}
Grammar Focus: ${lesson.grammar}
Seed: ${seed}

Create a sentence where the blank "___" tests the grammar focus (${lesson.grammar}).
Reply ONLY with a raw JSON object (no markdown, no code fences):
  sentence: string — sentence with exactly one "___"
  answer: string — correct word or phrase
  hint: string — tip referencing ${lesson.grammar}
  explanation: string — why this answer fits the grammar rule`;
  return JSON.parse(callAgy(prompt));
}

export function getLessonChatPrompt(lesson) {
  const prompt = `You are a conversational English tutor for a student working on:
Lesson: ${lesson.title} (${lesson.grammar}).
Ask the student ONE engaging, simple question in English related to "${lesson.topic}" that prompts them to reply using "${lesson.grammar}".
Keep it short (1-2 sentences).`;
  return callAgy(prompt);
}

export function getLessonTheory(lesson) {
  const prompt = `You are a master English linguistics and grammar teacher.
Generate a concise, crystal-clear "Micro-Theory Cheat Sheet" in Spanish for a student about to start this lesson:
Level: ${lesson.unitLevel}
Lesson: ${lesson.title}
Grammar Focus: ${lesson.grammar}
Topic: ${lesson.topic}

Include:
1. Core Rule: Explain the concept simply in Spanish.
2. Common Pitfalls / Traps: What mistakes do Spanish speakers usually make here? (e.g. sound vs letter for a/an, missing 's' in 3rd person).
3. 3 Clear Formula/Examples with English and Spanish translation.

Reply ONLY with a raw JSON object (no markdown, no code fences):
  title: string
  explanation: string (2-3 sentences explaining the core concept in Spanish)
  rules: Array<{ rule: string, example: string, note: string }>
  tip: string (a golden rule or memory trick in Spanish)`;
  return JSON.parse(callAgy(prompt));
}

export function roleplayTurn(scenario, chatHistory, userMessage, objectives) {
  const prompt = `You are the engine of an English conversational roleplay simulation.
Scenario: "${scenario.title}" — ${scenario.description}
Your Role/Character: "${scenario.character}"
Required Student Objectives:
${objectives.map((o) => `- ID ${o.id}: "${o.text}" (Currently completed: ${o.completed})`).join('\n')}

Conversation History:
${chatHistory.map((m) => `${m.role}: ${m.text}`).join('\n')}
User: "${userMessage}"

Tasks:
1. Check if the user's latest message has serious grammar/spelling errors.
2. If grammar is acceptable, check which objective IDs have now been satisfied.
3. Generate the next realistic, in-character response (1-2 sentences maximum).

Reply ONLY with a raw JSON object (no markdown, no code fences):
  grammar: {
    isCorrect: boolean,
    corrections: string[],
    correctedText: string,
    explanation: string
  },
  newlyCompletedIds: number[],
  characterReply: string`;
  return JSON.parse(callAgy(prompt));
}

export function getSlangWorkout(category = 'tech') {
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate a high-impact Phrasal Verbs & Real-World Slang mini-workout.
Category: "${category}" (options: tech/workplace, everyday life, business, idioms)
Seed: ${seed}

Provide 3 distinct items:
For each item:
- phrase: string (e.g. "touch base", "call it a day", "figure out")
- literalMeaning: string in Spanish (what it sounds like literally)
- realMeaning: string in Spanish (what it actually means)
- situation: string in Spanish (when native speakers use it)
- example: string (natural conversation dialogue in English)
- challenge: {
    prompt: string,
    answer: string,
    hint: string
  }

Reply ONLY with a raw JSON object (no markdown, no code fences):
  categoryTitle: string,
  items: Array<{
    phrase: string,
    literalMeaning: string,
    realMeaning: string,
    situation: string,
    example: string,
    challenge: { prompt: string, answer: string, hint: string }
  }>`;
  return JSON.parse(callAgy(prompt));
}

export function getListeningPhrase(difficulty = 'beginner') {
  const seed = Math.floor(Math.random() * 10000);
  const prompt = `Generate a realistic English sentence for a Listening & Dictation audio exercise.
Difficulty: ${difficulty}
- beginner: 4-7 words, clear vocabulary, basic connected speech.
- intermediate: 8-13 words, natural speed, phrasal verbs, contractions (wanna, gonna, should've).
- advanced: 12-18 words, idioms, fast connected speech, nuanced phonetics.
Seed: ${seed}

Reply ONLY with a raw JSON object (no markdown, no code fences):
  phrase: string (the spoken English sentence)
  translation: string (Spanish translation)
  phoneticIpa: string (IPA transcription, e.g. /aɪ wɒnt tə ɡəʊ/)
  listeningTip: string (a tip about connected speech or pronunciation in this sentence, in Spanish)`;
  return JSON.parse(callAgy(prompt));
}

export function evaluateListening(original, transcription) {
  const prompt = `You are an English phonetics and listening comprehension tutor.
Original spoken sentence: "${original}"
Student's transcription: "${transcription}"

Evaluate the student's dictation accuracy.
Identify:
1. Exact match vs missed words.
2. Connected speech / phonetics explanation: why did the student mishear those specific sounds? (e.g. linking words, silent letters, schwa reduction, elision).

Reply ONLY with a raw JSON object (no markdown, no code fences):
  isCorrect: boolean (true if match >= 85%)
  score: number (0-100)
  missedWords: string[] (words missed or misheard)
  phoneticInsight: string (explanation of the listening challenge in Spanish)
  feedback: string (brief encouraging summary)`;
  return JSON.parse(callAgy(prompt));
}
