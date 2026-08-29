import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as tutor from '../src/services/tutor.js';

/**
 * Contract tests between the AI schemas and the code that consumes them.
 *
 * These exist because a schema was silently flattened from
 * `Array<{wrong, correct, rule, theory, example}>` to `string[]` during the
 * provider-port refactor. Nothing failed: the UI printed "undefined -> undefined"
 * and recordError(undefined) returned early, so translation mistakes stopped
 * producing SRS cards at all. Types cannot catch this — the payload crosses a
 * network boundary — so the field names get asserted here.
 */
describe('Tutor schema contracts', () => {
  const requiredOf = (schema) => schema.required ?? [];
  const propsOf = (schema) => schema.properties ?? {};

  const assertDeclares = (schema, fields, label) => {
    for (const field of fields) {
      assert.ok(propsOf(schema)[field], `${label} must declare "${field}"`);
      assert.ok(requiredOf(schema).includes(field), `${label} must require "${field}"`);
    }
  };

  test('GRAMMAR_SCHEMA covers what chat.js reads', () => {
    assertDeclares(tutor.GRAMMAR_SCHEMA, ['isCorrect', 'corrections', 'correctedText'], 'GRAMMAR_SCHEMA');
  });

  test('PHRASE_SCHEMA covers what translate.js and path.js read', () => {
    assertDeclares(tutor.PHRASE_SCHEMA, ['spanish', 'english', 'hint'], 'PHRASE_SCHEMA');
  });

  test('FILLBLANK_SCHEMA covers what fillblank.js reads, including explanation', () => {
    assertDeclares(tutor.FILLBLANK_SCHEMA, ['sentence', 'answer', 'hint', 'explanation'], 'FILLBLANK_SCHEMA');
  });

  test('LESSON_FILLBLANK_SCHEMA covers what path.js reads', () => {
    assertDeclares(tutor.LESSON_FILLBLANK_SCHEMA, ['sentence', 'answer', 'hint', 'explanation'], 'LESSON_FILLBLANK_SCHEMA');
  });

  test('TRANSLATION_SCHEMA errors are objects, not strings', () => {
    assertDeclares(tutor.TRANSLATION_SCHEMA, ['isCorrect', 'score', 'feedback', 'errors'], 'TRANSLATION_SCHEMA');

    const errors = propsOf(tutor.TRANSLATION_SCHEMA).errors;
    assert.strictEqual(errors.type, 'array');
    assert.strictEqual(errors.items?.type, 'object', 'each error must be an object, not a string');

    // The exercise UI renders err.wrong -> err.correct with err.rule/err.theory,
    // and files err.rule as the SRS card key.
    for (const field of ['wrong', 'correct', 'rule', 'theory', 'example']) {
      assert.ok(errors.items.properties?.[field], `TRANSLATION_SCHEMA error items must declare "${field}"`);
    }
    assert.ok(errors.items.required?.includes('rule'), '"rule" is the SRS card key and must be required');
  });

  test('MISTAKE_SCHEMA covers what review.js reads', () => {
    assertDeclares(
      tutor.MISTAKE_SCHEMA,
      ['ruleRecap', 'tip', 'exercise', 'hint', 'answer', 'explanation'],
      'MISTAKE_SCHEMA'
    );
  });

  test('THEORY_SCHEMA rule items expose rule/example/note', () => {
    assertDeclares(tutor.THEORY_SCHEMA, ['title', 'explanation', 'rules', 'tip'], 'THEORY_SCHEMA');
    const rules = propsOf(tutor.THEORY_SCHEMA).rules;
    for (const field of ['rule', 'example', 'note']) {
      assert.ok(rules.items?.properties?.[field], `THEORY_SCHEMA rules must declare "${field}"`);
    }
  });

  test('ROLEPLAY_SCHEMA covers what roleplay.js reads', () => {
    assertDeclares(
      tutor.ROLEPLAY_SCHEMA,
      ['grammar', 'newlyCompletedIds', 'characterReply'],
      'ROLEPLAY_SCHEMA'
    );
    for (const field of ['isCorrect', 'corrections', 'correctedText']) {
      assert.ok(propsOf(tutor.ROLEPLAY_SCHEMA).grammar.properties?.[field], `grammar must declare "${field}"`);
    }
  });

  test('SLANG_SCHEMA item shape covers what slang.js renders', () => {
    assertDeclares(tutor.SLANG_SCHEMA, ['categoryTitle', 'items'], 'SLANG_SCHEMA');
    const item = propsOf(tutor.SLANG_SCHEMA).items.items;
    for (const field of ['phrase', 'literalMeaning', 'realMeaning', 'situation', 'example', 'challenge']) {
      assert.ok(item.properties?.[field], `SLANG_SCHEMA items must declare "${field}"`);
    }
    for (const field of ['prompt', 'answer', 'hint']) {
      assert.ok(item.properties.challenge.properties?.[field], `challenge must declare "${field}"`);
    }
  });

  test('listening schemas cover what listening.js reads', () => {
    assertDeclares(
      tutor.LISTENING_PHRASE_SCHEMA,
      ['phrase', 'translation', 'phoneticIpa', 'listeningTip'],
      'LISTENING_PHRASE_SCHEMA'
    );
    assertDeclares(
      tutor.LISTENING_EVAL_SCHEMA,
      ['isCorrect', 'score', 'missedWords', 'phoneticInsight', 'feedback'],
      'LISTENING_EVAL_SCHEMA'
    );
  });

  test('WORD_OF_DAY_SCHEMA covers what index.js renders', () => {
    assertDeclares(
      tutor.WORD_OF_DAY_SCHEMA,
      ['word', 'partOfSpeech', 'definition', 'example'],
      'WORD_OF_DAY_SCHEMA'
    );
  });
});
