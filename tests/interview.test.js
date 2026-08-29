import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_PRESETS,
  SENIORITY_LEVELS,
  COMPANY_PROFILES,
  getFallbackQuestions,
  calculateHiringVerdict,
  buildTranscriptSummary
} from '../src/services/interview.js';

describe('Personalized Tech Mock Interview Engine', () => {
  test('ROLE_PRESETS contains standard engineering disciplines with tech stacks', () => {
    assert.ok(ROLE_PRESETS.length >= 5);
    const backend = ROLE_PRESETS.find((r) => r.id === 'backend');
    assert.ok(backend);
    assert.ok(backend.defaultStack.includes('Node.js') || backend.defaultStack.includes('PostgreSQL'));
  });

  test('SENIORITY_LEVELS and COMPANY_PROFILES are properly configured', () => {
    assert.strictEqual(SENIORITY_LEVELS.length, 3);
    assert.strictEqual(COMPANY_PROFILES.length, 3);
  });

  test('getFallbackQuestions generates exactly 4 distinct multi-round questions', () => {
    const profile = {
      roleTitle: 'Senior Backend Engineer',
      techStack: 'Node.js, PostgreSQL, Docker',
      seniority: 'Senior (5+ years)',
      companyProfile: 'US Tech Startup'
    };

    const questions = getFallbackQuestions(profile);
    assert.strictEqual(questions.length, 4);
    assert.strictEqual(questions[0].round, 1);
    assert.ok(questions[0].question.includes('Node.js') || questions[0].question.includes('background'));
    assert.strictEqual(questions[1].round, 2);
    assert.strictEqual(questions[2].round, 3);
    assert.strictEqual(questions[3].round, 4);
  });

  test('calculateHiringVerdict correctly classifies candidate scores', () => {
    assert.strictEqual(calculateHiringVerdict(90), 'STRONG HIRE 🟢');
    assert.strictEqual(calculateHiringVerdict(78), 'HIRE 🟢');
    assert.strictEqual(calculateHiringVerdict(68), 'LEANING HIRE 🟡');
    assert.strictEqual(calculateHiringVerdict(55), 'LEANING NO 🟡');
    assert.strictEqual(calculateHiringVerdict(40), 'NO HIRE 🔴');
  });

  describe('buildTranscriptSummary', () => {
    const round = (extra) => ({
      round: 1,
      question: 'Tell me about your architecture experience.',
      answer: 'I led the migration to event-driven services.',
      wpm: 130,
      ...extra
    });

    test('labels a measured round so the committee knows it heard speech', () => {
      const summary = buildTranscriptSummary([round({ transcriptSource: 'whisper-cpp' })]);

      assert.match(summary, /transcribed from audio/i);
      assert.match(summary, /130 WPM/);
      assert.doesNotMatch(summary, /typed|self-reported/i);
    });

    test('flags a self-reported round so fluency is not scored as if heard', () => {
      // Without this the committee reports a CEFR speaking band for text the
      // candidate typed — the exact fake measurement this mode used to ship.
      const summary = buildTranscriptSummary([round({ transcriptSource: 'self-reported' })]);

      assert.match(summary, /typed|self-reported/i);
      assert.match(summary, /not.*(speech|audio)|do not score/i);
    });

    test('treats a missing source as self-reported rather than measured', () => {
      const summary = buildTranscriptSummary([round({})]);
      assert.match(summary, /typed|self-reported/i);
    });

    test('renders every round in order', () => {
      const summary = buildTranscriptSummary([
        round({ round: 1, transcriptSource: 'whisper-cpp' }),
        round({ round: 2, question: 'Design a rate limiter.', transcriptSource: 'whisper-cpp' })
      ]);

      assert.ok(summary.indexOf('Round 1') < summary.indexOf('Round 2'));
      assert.match(summary, /rate limiter/);
    });

    test('handles an empty interview without throwing', () => {
      assert.strictEqual(buildTranscriptSummary([]), '');
    });
  });
});
