import { askText, askJson } from './ai/port.js';

/**
 * Domain-level tutoring prompts.
 *
 * This module knows nothing about which AI provider answers: it composes a
 * prompt plus the JSON shape it needs and hands both to the port. Field
 * semantics live in the schema descriptions, so the prompts no longer repeat
 * "reply ONLY with raw JSON" — the provider enforces the shape.
 */

const SPANISH_TOPICS = ['family', 'food and cooking', 'work and jobs', 'travel', 'weather', 'sports', 'technology', 'health', 'shopping', 'school and education', 'nature', 'music', 'movies', 'daily routines', 'feelings and emotions', 'animals', 'cities and places', 'money', 'hobbies', 'time and schedules'];
const FILLBLANK_TOPICS = ['prepositions of place', 'articles (a/an/the)', 'verb tenses', 'modal verbs', 'phrasal verbs', 'comparatives and superlatives', 'collocations', 'conjunctions', 'conditionals', 'relative clauses', 'passive voice', 'reported speech'];

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSeed() {
  return Math.floor(Math.random() * 10000);
}

const str = (description) => ({ type: 'string', description });
const bool = (description) => ({ type: 'boolean', description });
const num = (description) => ({ type: 'number', description });
const strArray = (description) => ({ type: 'array', items: { type: 'string' }, description });

/** @param {Record<string, object>} properties */
const objectSchema = (properties) => ({
  type: 'object',
  properties,
  required: Object.keys(properties)
});

export const GRAMMAR_SCHEMA = objectSchema({
  isCorrect: bool('true only if the text has NO grammar or spelling errors'),
  corrections: {
    type: 'array',
    description: 'one entry per mistake; empty when isCorrect is true',
    items: objectSchema({
      wrong: str('the exact word or phrase the user wrote'),
      correct: str('what it should be'),
      rule: str(
        'a CANONICAL, reusable grammar rule name in Title Case, e.g. ' +
        '"Past Simple with Irregular Verbs" or "Third-Person Singular Agreement". ' +
        'Name the rule, never describe this particular sentence — the same mistake ' +
        'must always produce the same name so it can be tracked over time.'
      ),
      explanation: str('one sentence on why it is wrong, in simple English')
    })
  },
  correctedText: str('the fixed version of the text'),
  explanation: str('brief explanation in simple English; empty when isCorrect is true')
});

/**
 * @param {string} text
 * @returns {Promise<{ isCorrect: boolean, corrections: Array<{ wrong: string, correct: string, rule: string, explanation: string }>, correctedText: string, explanation: string }>}
 */
export async function checkGrammar(text) {
  return askJson(
    `You are a strict English grammar checker. Check the following text for grammar and spelling errors.\n\nText: "${text}"`,
    GRAMMAR_SCHEMA
  );
}

export async function chatReply(userMessage) {
  return askText(
    `You are a friendly, concise English conversation assistant.\n` +
    `The user has passed the grammar check. Reply naturally in 1-3 sentences.\n\nUser: ${userMessage}`
  );
}

export const PHRASE_SCHEMA = objectSchema({
  spanish: str('the Spanish sentence'),
  english: str('the correct English translation'),
  hint: str('a short grammar hint, e.g. "Watch the tense"')
});

/**
 * @param {string} difficulty
 * @returns {Promise<{ spanish: string, english: string, hint: string }>}
 */
export async function getSpanishPhrase(difficulty) {
  return askJson(
    `Generate a single Spanish sentence for an English translation exercise.\n` +
    `Topic: ${randomPick(SPANISH_TOPICS)} (seed: ${randomSeed()})\n` +
    `Difficulty: ${difficulty}\n` +
    `- beginner: simple present tense, common vocabulary, short sentences\n` +
    `- intermediate: past/future tenses, idioms, compound sentences\n` +
    `- advanced: subjunctive, complex grammar, figurative language`,
    PHRASE_SCHEMA
  );
}

export const FILLBLANK_SCHEMA = objectSchema({
  sentence: str('an English sentence containing exactly one "___" blank'),
  answer: str('the single correct word or short phrase for the blank'),
  hint: str('a grammar or vocabulary hint'),
  explanation: str('why this answer fits the grammar rule')
});

/**
 * @param {string} difficulty
 * @returns {Promise<{ sentence: string, answer: string, hint: string, explanation: string }>}
 */
export async function getFillBlank(difficulty) {
  return askJson(
    `Generate an English fill-in-the-blank exercise.\n` +
    `Topic: ${randomPick(FILLBLANK_TOPICS)} (seed: ${randomSeed()})\n` +
    `Difficulty: ${difficulty}\n` +
    `- beginner: articles, simple verbs, prepositions\n` +
    `- intermediate: phrasal verbs, conjunctions, modal verbs\n` +
    `- advanced: collocations, idiomatic expressions, nuanced vocabulary`,
    FILLBLANK_SCHEMA
  );
}

export const TRANSLATION_SCHEMA = objectSchema({
  isCorrect: bool('true if score is 80 or above'),
  score: num('0-100 accuracy score'),
  feedback: str('one sentence summary of the overall quality'),
  errors: {
    type: 'array',
    description: 'one entry per mistake; empty when the translation is correct',
    items: objectSchema({
      wrong: str('the exact word or phrase the user wrote'),
      correct: str('what it should be'),
      rule: str('the grammar rule name, e.g. "Third-person singular present tense"'),
      theory: str('2-3 sentence explanation of the rule from scratch'),
      example: str('a second example sentence demonstrating the correct rule')
    })
  }
});

/**
 * @param {string} original
 * @param {string} userTranslation
 * @param {string} correctTranslation
 * @returns {Promise<{ isCorrect: boolean, score: number, feedback: string, errors: Array<{ wrong: string, correct: string, rule: string, theory: string, example: string }> }>}
 */
export async function checkTranslation(original, userTranslation, correctTranslation) {
  return askJson(
    `You are an English grammar teacher evaluating a translation.\n` +
    `Original Spanish: "${original}"\n` +
    `Correct English translation: "${correctTranslation}"\n` +
    `User translation: "${userTranslation}"\n\n` +
    `Minor wording differences are acceptable if the meaning is correct.\n` +
    `For every error, explain the GRAMMAR THEORY behind it — not just what is wrong, but WHY. ` +
    `Include the rule name, how it works, and a second example to reinforce it.`,
    TRANSLATION_SCHEMA
  );
}

export const WORD_OF_DAY_SCHEMA = objectSchema({
  word: str('the word itself'),
  partOfSpeech: str('e.g. noun, verb, adjective'),
  definition: str('clear, simple definition'),
  example: str('a natural example sentence using the word')
});

/**
 * @returns {Promise<{ word: string, partOfSpeech: string, definition: string, example: string }>}
 */
export async function getWordOfDay() {
  return askJson(
    `Generate an interesting English word of the day for a Spanish speaker learning English.\n` +
    `Choose a useful, practical word (not too obscure). Seed: ${randomSeed()}`,
    WORD_OF_DAY_SCHEMA
  );
}

export const MISTAKE_SCHEMA = objectSchema({
  ruleRecap: str('1-2 sentence explanation in Spanish of the rule and how to fix it'),
  tip: str('a quick actionable rule of thumb in Spanish'),
  exercise: str('exercise instruction plus the sentence to fix or complete'),
  hint: str('a subtle clue pointing to where the error is'),
  answer: str('the exact correct sentence or word'),
  explanation: str('why this answer is correct, in English')
});

/**
 * @param {string} errorType
 * @returns {Promise<{ ruleRecap: string, tip: string, exercise: string, hint: string, answer: string, explanation: string }>}
 */
export async function getMistakeExercise(errorType) {
  return askJson(
    `You are a personalized English grammar tutor helping a Spanish speaker review a past mistake.\n` +
    `Error/Rule: "${errorType}"\n\nCreate a targeted review flashcard.`,
    MISTAKE_SCHEMA
  );
}

/**
 * @param {any} lesson
 * @returns {Promise<{ spanish: string, english: string, hint: string }>}
 */
export async function getLessonPhrase(lesson) {
  return askJson(
    `Generate a single Spanish sentence for an English translation exercise for this lesson:\n` +
    `Lesson Title: ${lesson.title}\nTarget Topic: ${lesson.topic}\nGrammar Focus: ${lesson.grammar}\n` +
    `Seed: ${randomSeed()}\n\nThe sentence must test the exact grammar focus and topic above.`,
    PHRASE_SCHEMA
  );
}

export const LESSON_FILLBLANK_SCHEMA = objectSchema({
  sentence: str('sentence containing exactly one "___" blank'),
  answer: str('correct word or phrase'),
  hint: str('tip referencing the lesson grammar focus'),
  explanation: str('why this answer fits the grammar rule')
});

/**
 * @param {any} lesson
 * @returns {Promise<{ sentence: string, answer: string, hint: string, explanation: string }>}
 */
export async function getLessonFillBlank(lesson) {
  return askJson(
    `Generate an English fill-in-the-blank exercise for this lesson:\n` +
    `Lesson Title: ${lesson.title}\nTarget Topic: ${lesson.topic}\nGrammar Focus: ${lesson.grammar}\n` +
    `Seed: ${randomSeed()}\n\nThe blank must test ${lesson.grammar}.`,
    LESSON_FILLBLANK_SCHEMA
  );
}

export async function getLessonChatPrompt(lesson) {
  return askText(
    `You are a conversational English tutor for a student working on:\n` +
    `Lesson: ${lesson.title} (${lesson.grammar}).\n` +
    `Ask ONE engaging, simple question in English related to "${lesson.topic}" that prompts a reply using "${lesson.grammar}". Keep it to 1-2 sentences.`
  );
}

export const THEORY_SCHEMA = objectSchema({
  title: str('cheat sheet title'),
  explanation: str('2-3 sentences explaining the core concept in Spanish'),
  rules: {
    type: 'array',
    description: 'three formula/example entries',
    items: objectSchema({
      rule: str('the formula or rule'),
      example: str('English example with Spanish translation'),
      note: str('short clarifying note')
    })
  },
  tip: str('a golden rule or memory trick in Spanish')
});

/**
 * @param {any} lesson
 * @returns {Promise<{ title: string, explanation: string, rules: Array<{ rule: string, example: string, note: string }>, tip: string }>}
 */
export async function getLessonTheory(lesson) {
  return askJson(
    `You are a master English linguistics and grammar teacher.\n` +
    `Generate a concise "Micro-Theory Cheat Sheet" in Spanish for this lesson:\n` +
    `Level: ${lesson.unitLevel}\nLesson: ${lesson.title}\nGrammar Focus: ${lesson.grammar}\nTopic: ${lesson.topic}\n\n` +
    `Cover the core rule, the traps Spanish speakers fall into (e.g. sound vs letter for a/an, missing 3rd person 's'), and 3 formula examples.`,
    THEORY_SCHEMA
  );
}

export const ROLEPLAY_SCHEMA = objectSchema({
  grammar: objectSchema({
    isCorrect: bool('true if the message has no serious errors'),
    corrections: {
    type: 'array',
    description: 'one entry per mistake; empty when isCorrect is true',
    items: objectSchema({
      wrong: str('the exact word or phrase the user wrote'),
      correct: str('what it should be'),
      rule: str(
        'a CANONICAL, reusable grammar rule name in Title Case, e.g. ' +
        '"Past Simple with Irregular Verbs" or "Third-Person Singular Agreement". ' +
        'Name the rule, never describe this particular sentence — the same mistake ' +
        'must always produce the same name so it can be tracked over time.'
      ),
      explanation: str('one sentence on why it is wrong, in simple English')
    })
  },
    correctedText: str('corrected message'),
    explanation: str('brief explanation')
  }),
  newlyCompletedIds: {
    type: 'array',
    items: { type: 'number' },
    description: 'objective IDs satisfied by this message'
  },
  characterReply: str('the next in-character response, 1-2 sentences maximum')
});

/**
 * @param {any} scenario
 * @param {any[]} chatHistory
 * @param {string} userMessage
 * @param {any[]} objectives
 * @returns {Promise<{ grammar: { isCorrect: boolean, corrections: Array<{ wrong: string, correct: string, rule: string, explanation: string }>, correctedText: string, explanation: string }, newlyCompletedIds: number[], characterReply: string }>}
 */
export async function roleplayTurn(scenario, chatHistory, userMessage, objectives) {
  return askJson(
    `You are the engine of an English conversational roleplay simulation.\n` +
    `Scenario: "${scenario.title}" — ${scenario.description}\n` +
    `Your Role/Character: "${scenario.character}"\n` +
    `Required Student Objectives:\n${objectives.map((o) => `- ID ${o.id}: "${o.text}" (completed: ${o.completed})`).join('\n')}\n\n` +
    `Conversation History:\n${chatHistory.map((m) => `${m.role}: ${m.text}`).join('\n')}\n` +
    `User: "${userMessage}"\n\n` +
    `Check the user's grammar, determine which objectives are now satisfied, and continue in character.`,
    ROLEPLAY_SCHEMA
  );
}

export const SLANG_SCHEMA = objectSchema({
  categoryTitle: str('title for this workout category'),
  items: {
    type: 'array',
    description: 'exactly 3 distinct items',
    items: objectSchema({
      phrase: str('e.g. "touch base", "call it a day"'),
      literalMeaning: str('in Spanish: what it sounds like literally'),
      realMeaning: str('in Spanish: what it actually means'),
      situation: str('in Spanish: when native speakers use it'),
      example: str('natural English conversation dialogue'),
      challenge: objectSchema({
        prompt: str('the challenge question'),
        answer: str('expected answer'),
        hint: str('a hint')
      })
    })
  }
});

/**
 * @param {string} [category]
 * @returns {Promise<{ categoryTitle: string, items: Array<{ phrase: string, literalMeaning: string, realMeaning: string, situation: string, example: string, challenge: { prompt: string, answer: string, hint: string } }> }>}
 */
export async function getSlangWorkout(category = 'tech') {
  return askJson(
    `Generate a high-impact Phrasal Verbs & Real-World Slang mini-workout.\n` +
    `Category: "${category}" (tech/workplace, everyday life, business, idioms)\n` +
    `Seed: ${randomSeed()}\n\nProvide 3 distinct items.`,
    SLANG_SCHEMA
  );
}

export const LISTENING_PHRASE_SCHEMA = objectSchema({
  phrase: str('the spoken English sentence'),
  translation: str('Spanish translation'),
  phoneticIpa: str('IPA transcription, e.g. /aɪ wɒnt tə ɡəʊ/'),
  listeningTip: str('tip in Spanish about the connected speech in this sentence')
});

/**
 * @param {string} [difficulty]
 * @returns {Promise<{ phrase: string, translation: string, phoneticIpa: string, listeningTip: string }>}
 */
export async function getListeningPhrase(difficulty = 'beginner') {
  return askJson(
    `Generate a realistic English sentence for a Listening & Dictation exercise.\n` +
    `Difficulty: ${difficulty}\n` +
    `- beginner: 4-7 words, clear vocabulary, basic connected speech\n` +
    `- intermediate: 8-13 words, natural speed, phrasal verbs, contractions\n` +
    `- advanced: 12-18 words, idioms, fast connected speech\n` +
    `Seed: ${randomSeed()}`,
    LISTENING_PHRASE_SCHEMA
  );
}

export const LISTENING_EVAL_SCHEMA = objectSchema({
  isCorrect: bool('true if the match is 85% or better'),
  score: num('0-100'),
  missedWords: strArray('words missed or misheard'),
  phoneticInsight: str('explanation in Spanish of the listening challenge'),
  feedback: str('brief encouraging summary')
});

/**
 * @param {string} original
 * @param {string} transcription
 * @returns {Promise<{ isCorrect: boolean, score: number, missedWords: string[], phoneticInsight: string, feedback: string }>}
 */
export async function evaluateListening(original, transcription) {
  return askJson(
    `You are an English phonetics and listening comprehension tutor.\n` +
    `Original spoken sentence: "${original}"\nStudent's transcription: "${transcription}"\n\n` +
    `Evaluate dictation accuracy and explain WHY those specific sounds were misheard ` +
    `(linking, silent letters, schwa reduction, elision).`,
    LISTENING_EVAL_SCHEMA
  );
}
