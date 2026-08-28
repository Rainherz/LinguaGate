import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { isRecorderAvailable, startRecording } from '../services/recorder.js';
import { evaluateSpeechMetrics, evaluateSpokenWithAI, diffSpokenWords, diagnoseArticulation } from '../services/speech.js';
import { isTranscriptionAvailable, transcribeAudio } from '../services/transcriber.js';
import { updateStreak, recordError } from '../services/history.js';
import { playAudio, playAudioSlow, playAudioUltraSlow, playAudioFile } from '../services/audio.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';

export const PRACTICE_SENTENCES = [
  {
    id: 'spk_architecture',
    level: 'C1',
    sentence: "Not only does the new architecture reduce latency, but it also scales seamlessly.",
    phonetics: "/nɑːt ˈoʊnli dʌz ðə nuː ˈɑːrkətɛktʃər rɪˈduːs ˈleɪtənsi bʌt ɪt ˈɔːlsoʊ skeɪlz ˈsiːmləsli/",
    stressTip: "AR-chi-tecture (accent on 'AR', 'ch' sounds like /k/), LA-tency, SEAM-less-ly.",
    traps: [
      "No pronuncies 'es-scales' (no agregues una 'e' antes de 'scales')",
      "'ch' en 'architecture' suena a /k/ como en 'kilo', no a /ch/",
      "Uní 'Not only' como una sola palabra (/nɑ'toʊnli/)"
    ],
    checks: [
      "¿Dijiste /'ɑːrkɪtɛktʃər/ con 'k' en vez de 'ch'?",
      "¿Arrancaste 'scales' con /s/ directo sin decir 'escales'?",
      "¿Marcaste el énfasis en 'Not ONLY' y 'SEAM-lessly'?"
    ]
  },
  {
    id: 'spk_collaborate',
    level: 'A2',
    sentence: "I'm looking forward to collaborating with your engineering team.",
    phonetics: "/aɪm ˈlʊkɪŋ ˈfɔːrwərd tuː kəˈlæbəˌreɪtɪŋ wɪð jɔːr ˌɛnʤɪˈnɪrɪŋ tiːm/",
    stressTip: "col-LAB-orating (accent on 'LAB'), engi-NEER-ing (accent on 'NEER').",
    traps: [
      "Reducción: 'to' se pronuncia suave /tə/, no /tu:/ marcado",
      "Link: 'look-ing_for-ward_to' se dice de un solo tirón"
    ],
    checks: [
      "¿Dijiste 'col-LAB-orating' acentuando la segunda sílaba?",
      "¿El 'with' sonó suave con /ð/ y no como una 'd' dura?",
      "¿La 'i' en 'team' fue una vocal larga /tiːm/ y no corta?"
    ]
  },
  {
    id: 'spk_production',
    level: 'B1',
    sentence: "We should prioritize resolving this critical production outage immediately.",
    phonetics: "/wiː ʃʊd praɪˈɔːrɪˌtaɪz rɪˈzɑːlvɪŋ ðɪs ˈkrɪtɪkəl prəˈdʌkʃən ˈaʊtɪʤ ɪˈmiːdiətli/",
    stressTip: "pri-OR-i-tize, CRI-ti-cal, pro-DUC-tion, im-ME-diate-ly.",
    traps: [
      "Letra muda: La 'L' en 'should' es 100% MUDA (/ʃʊd/, nunca 'shuld')",
      "'outage' termina en sonido /ɪʤ/ (como 'package'), no /eidzh/"
    ],
    checks: [
      "¿Omitiste por completo la 'L' en 'should' (/ʃʊd/)?",
      "¿Acentuaste 'im-ME-diately' en la segunda sílaba?",
      "¿La 't' final de 'outage' y 'critical' fue clara y no comida?"
    ]
  },
  {
    id: 'spk_testing',
    level: 'B2',
    sentence: "Had we implemented automated testing earlier, we would have avoided this bug.",
    phonetics: "/hæd wiː ˈɪmpləmɛntɪd ˈɔːtəmeɪtɪd ˈtɛstɪŋ ˈɜːrliər wiː wʊd hæv əˈvɔɪdɪd ðɪs bʌɡ/",
    stressTip: "IM-plemented, AU-tomated, a-VOID-ed.",
    traps: [
      "Terminación -ed: 'implemented' y 'avoided' terminan en /ɪd/ (dos sílabas)",
      "Letra muda: La 'L' en 'would' es 100% MUDA (/wʊd/)"
    ],
    checks: [
      "¿Pronunciaste 'would' sin la 'L' (/wʊd/)?",
      "¿El final de 'avoided' sonó claramente como /ɪd/?",
      "¿No agregaste una 'e' antes de 'testing'?"
    ]
  }
];

export async function runSpeakingLab(stats) {
  while (true) {
    clearScreen();
    printAppHeader('Speaking & Pronunciation Lab');

    const hasMic = isRecorderAvailable();
    const hasStt = isTranscriptionAvailable();
    const micStatus = hasMic
      ? chalk.green('✔ Microphone Active')
      : chalk.yellow('⚠ No Microphone Detected (Text Simulation Mode)');
    const sttStatus = hasStt
      ? chalk.green('✔ Local transcription ready — scores are measured')
      : chalk.yellow('⚠ No speech-to-text engine — scores will be self-reported');

    console.log(
      boxen(
        `${chalk.bold.white('Speech Evaluation:')}\n\n` +
        `  ${chalk.dim('• Microphone:')}      ${micStatus}\n` +
        `  ${chalk.dim('• Transcription:')}   ${sttStatus}\n` +
        `  ${chalk.dim('• Measured:')}        WPM cadence, word precision vs target, filler count\n` +
        `  ${chalk.dim('• Inferred by AI:')}  Word stress, connected speech, IELTS band ${chalk.dim('(from the transcript, not the waveform)')}\n` +
        `  ${chalk.dim('• Self-Monitoring:')} [p] Play YOUR recording ➔ Compare with [r] Native Model`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'magenta',
          dimBorder: true
        }
      )
    );

    const action = await safeSelect({
      message: 'Select speaking workout (Esc to return):',
      choices: [
        { name: '🔙 Back to Main Menu (or press Esc)', value: 'BACK' },
        { name: '🗣️  Read & Pronounce (Strict Phonetics & Traps Workout)', value: 'PRONOUNCE' },
        { name: '💬 Spoken Tech Q&A (Interview Fluency Simulation)', value: 'QA' }
      ]
    });

    if (!action || action === 'BACK') break;

    if (action === 'PRONOUNCE') {
      await runPronounceWorkout(stats, hasMic);
    }

    if (action === 'QA') {
      await runSpokenQA(stats, hasMic);
    }
  }
}

async function runPronounceWorkout(stats, hasMic) {
  let round = 0;
  const pool = [...PRACTICE_SENTENCES].sort(() => Math.random() - 0.5);

  while (round < pool.length) {
    const item = pool[round];
    round++;

    clearScreen();
    printAppHeader(`Read & Pronounce • [${round}/${pool.length}] (Level ${item.level})`);

    const trapsList = item.traps.map((t) => `  ${chalk.red('⚠')} ${chalk.yellow(t)}`).join('\n');

    const card =
      `${chalk.bold.white('Target Sentence:')}\n` +
      `"${chalk.bold.cyan(item.sentence)}"\n\n` +
      `${chalk.dim('IPA Phonetic Target:')}\n` +
      `  ${chalk.gray(item.phonetics)}\n\n` +
      `${chalk.bold.white('Stress & Rhythm:')}\n` +
      `  ${chalk.white(item.stressTip)}\n\n` +
      `${chalk.bold.red('🎯 Common Spanish Speaker Phonetic Traps:')}\n` +
      `${trapsList}`;

    console.log(
      boxen(card, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      })
    );

    // Audio preview options
    console.log(chalk.gray('  🔊 Audio controls: [r] normal, [s] slow, [u] ultra slow, [Enter] continue to speak\n'));
    await playAudio(item.sentence);

    while (true) {
      const audioControl = (await safeInput({ message: 'Listen again ([r]/[s]/[u]) or press Enter to record ›' })).trim().toLowerCase();
      if (audioControl === 'r') await playAudio(item.sentence);
      else if (audioControl === 's') await playAudioSlow(item.sentence);
      else if (audioControl === 'u') await playAudioUltraSlow(item.sentence);
      else break;
    }

    // Recording phase
    let spokenText;
    let durationSec = 3.0;
    let recordedPath = null;
    let transcriptSource = 'self-reported';
    /** @type {Array<{ word: string, probability: number }>} */
    let acousticWords = [];
    let clarityScore = 0;

    if (hasMic) {
      console.log(chalk.bold.yellow('\n  🎙️ Press Enter to START recording your voice:'));
      await safeInput({ message: 'Press Enter to Record ›' });

      const recorder = startRecording();
      const recordSpinner = ora({ text: '🔴 RECORDING... Speak now! Press Enter when finished.', color: 'red' }).start();

      await safeInput({ message: '' });
      recordSpinner.stop();

      const result = await recorder.stop();
      durationSec = result.durationSec;
      recordedPath = result.path;

      // Acoustic Self-Monitoring Phase
      clearScreen();
      printAppHeader('Acoustic Self-Monitoring Check');

      const checkList = item.checks.map((c) => `  [?] ${chalk.white(c)}`).join('\n');
      console.log(
        boxen(
          `${chalk.bold.yellow('👂 Compare Your Voice Against Native Model:')}\n\n` +
          `  ${chalk.cyan('[p]')} Listen to YOUR recording 🎧\n` +
          `  ${chalk.cyan('[r]')} Listen to NATIVE reference 🔊\n` +
          `  ${chalk.cyan('[s]')} Listen in SLOW motion 🐢\n\n` +
          `${chalk.bold.white('🔍 Self-Assessment Checklist (Did you sound like this?):')}\n` +
          `${checkList}`,
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'yellow'
          }
        )
      );

      while (true) {
        const playbackAction = (await safeInput({ message: 'Playback ([p] mine / [r] native / [s] slow / Enter to submit) ›' })).trim().toLowerCase();
        if (playbackAction === 'p') {
          console.log(chalk.cyan('  ▶ Playing your recorded voice...'));
          await playAudioFile(recordedPath);
        } else if (playbackAction === 'r') {
          console.log(chalk.yellow('  ▶ Playing native reference...'));
          await playAudio(item.sentence);
        } else if (playbackAction === 's') {
          await playAudioSlow(item.sentence);
        } else if (playbackAction === 'u') {
          await playAudioUltraSlow(item.sentence);
        } else {
          break;
        }
      }

      let stt = null;
      if (isTranscriptionAvailable()) {
        const sttSpinner = ora({
          text: '🧠 Transcribing what you actually said...',
          color: 'magenta',
          indent: 2
        }).start();
        stt = await transcribeAudio(recordedPath);
        if (stt.success) {
          sttSpinner.succeed(chalk.green(`Transcribed locally via ${stt.engine} 🧠`));
        } else {
          sttSpinner.warn(chalk.yellow(`Transcription unavailable: ${stt.error}`));
        }
      }

      if (stt && stt.success) {
        transcriptSource = stt.engine;
        acousticWords = stt.words || [];
        clarityScore = stt.clarityScore || 0;
        // Prefer measured speech span over wall-clock so lead-in silence
        // does not deflate the WPM reading.
        if (stt.speechDurationSec > 0) durationSec = stt.speechDurationSec;

        console.log(
          `\n  ${chalk.dim('👂 What the engine actually heard:')}\n` +
          `  ${chalk.bold.white(`"${stt.text}"`)}\n`
        );
        spokenText = stt.text;
      } else {
        console.log(
          chalk.yellow(
            '\n  ⚠ No transcript captured — the scores below are self-reported, not measured.\n'
          )
        );
        spokenText = (await safeInput({
          message: 'Type what you actually said (do NOT paste the target sentence) ›'
        })).trim();
      }
    } else {
      spokenText = (await safeInput({
        message: 'Type the sentence as you spoke it (Simulation) ›'
      })).trim();
    }

    if (!spokenText) continue;

    // Strict AI Diagnostic Evaluation
    const metrics = evaluateSpeechMetrics(item.sentence, spokenText, durationSec);
    const diagnosis = diagnoseArticulation(item.sentence, spokenText, acousticWords);
    const evalSpinner = ora({ text: 'Reviewing your transcript with the AI examiner...', color: 'magenta' }).start();
    const aiFeedback = await evaluateSpokenWithAI('Read aloud strict practice', spokenText, item.sentence, diagnosis);
    evalSpinner.stop();

    clearScreen();
    printAppHeader('IELTS Diagnostic Speech Scorecard');

    const flawsFormatted = aiFeedback.criticalFlaws && aiFeedback.criticalFlaws.length > 0
      ? aiFeedback.criticalFlaws.map((f) => `  ${chalk.red('✖')} ${chalk.yellow(f)}`).join('\n')
      : `  ${chalk.green('✔ No critical phonetic transfer errors detected.')}`;

    // Render target vs transcript with per-word alignment. This must live inside
    // the scorecard: the pre-evaluation echo is wiped by clearScreen() above.
    const { expectedTokens, actualTokens } = diffSpokenWords(item.sentence, spokenText);
    const renderTokens = (tokens, okColor) =>
      tokens
        .map((t) => (t.matched ? okColor(t.word) : chalk.bold.red.underline(t.word)))
        .join(' ');

    const comparison =
      `${chalk.bold.white('🎯 Target:')}   ${renderTokens(expectedTokens, chalk.gray)}\n` +
      `${chalk.bold.white('👂 You said:')} ${renderTokens(actualTokens, chalk.green)}\n` +
      (transcriptSource === 'self-reported'
        ? `${chalk.dim('   (typed by you — not measured from audio)')}\n`
        : `${chalk.dim(`   (transcribed from your audio by ${transcriptSource})`)}\n`);

    // Confidence alone would call a butchered sentence perfect: the recognizer
    // is sure of what IT heard, not of whether you said the target word.
    const VERDICT_LABEL = {
      'clean': chalk.green('clean ✔'),
      'unclear-delivery': chalk.yellow('unclear delivery ⚠'),
      'confident-substitution': chalk.red('confident substitution ✖'),
      'mumbled-substitution': chalk.red('slurred substitution ✖'),
      'substitution': chalk.red('substitution ✖'),
      'mixed': chalk.red('mixed errors ✖')
    };

    const SPAN_ARROW = chalk.dim('➔');
    const spanLines = diagnosis.spans.map((sp) => {
      const conf = sp.confidence === null ? '' : chalk.dim(` (${sp.confidence.toFixed(2)})`);
      if (sp.type === 'omission') {
        return `      ${chalk.gray(sp.target)} ${SPAN_ARROW} ${chalk.red('(dropped)')}`;
      }
      if (sp.type === 'insertion') {
        return `      ${chalk.gray('(nothing)')} ${SPAN_ARROW} ${chalk.red(sp.spoken)}${conf}`;
      }
      return `      ${chalk.gray(sp.target)} ${SPAN_ARROW} ${chalk.bold.red(sp.spoken)}${conf}`;
    });

    const unclearWords = diagnosis.words.filter((w) => w.verdict === 'unclear');
    const unclearLine = unclearWords.length > 0
      ? `  ${chalk.dim('• Said right, unclear:')}     ${unclearWords.map((w) => `${chalk.yellow(w.word)}${chalk.dim(` (${w.probability.toFixed(2)})`)}`).join(', ')}\n`
      : '';

    const measuredBlock = clarityScore > 0
      ? `  ${chalk.dim('• Articulation Confidence:')} ${chalk.white(`${clarityScore}/100`)} ${chalk.dim('(how sure the recognizer was of what it heard)')}\n` +
        `  ${chalk.dim('• Diagnosis:')}               ${VERDICT_LABEL[diagnosis.verdict] || diagnosis.verdict}\n` +
        (spanLines.length > 0
          ? `  ${chalk.dim('• What changed:')}\n${spanLines.join('\n')}\n`
          : '') +
        unclearLine +
        `  ${chalk.dim(diagnosis.summary)}\n`
      : '';

    const scoreCard =
      `${chalk.bold.yellow('📋 SPEAKING SCORECARD')}\n\n` +
      `${comparison}\n` +
      `${chalk.bold.green('── MEASURED FROM YOUR AUDIO ──')}\n` +
      `  ${chalk.dim('• Transcript Source:')}     ${transcriptSource === 'self-reported' ? chalk.yellow('self-reported ⚠ (install whisper for measured scores)') : chalk.green(`${transcriptSource} ✔`)}\n` +
      `  ${chalk.dim('• Speaking Cadence:')}      ${chalk.bold.white(metrics.wpm.label)}\n` +
      `  ${chalk.dim('• Word Precision:')}        ${metrics.accuracy.accuracyScore >= 90 ? chalk.green(`${metrics.accuracy.accuracyScore}% ✔`) : chalk.yellow(`${metrics.accuracy.accuracyScore}%`)}\n` +
      measuredBlock +
      `\n${chalk.bold.cyan('── INFERRED BY THE AI EXAMINER ──')}\n` +
      `  ${chalk.dim('• Estimated Level:')}       ${chalk.bold.cyan(aiFeedback.ieltsBand || 'Band 6.5')}\n` +
      `  ${chalk.dim('• Word Stress Score:')}     ${aiFeedback.wordStressScore >= 80 ? chalk.green(`${aiFeedback.wordStressScore}/100 ✔`) : chalk.yellow(`${aiFeedback.wordStressScore}/100 ⚠`)}\n` +
      `  ${chalk.dim('• Connected Speech:')}      ${aiFeedback.connectedSpeechScore >= 80 ? chalk.green(`${aiFeedback.connectedSpeechScore}/100 ✔`) : chalk.yellow(`${aiFeedback.connectedSpeechScore}/100 ⚠`)}\n\n` +
      `${chalk.bold.white('🔍 Examiner notes:')}\n` +
      `  ${aiFeedback.feedback}\n\n` +
      `${chalk.bold.red('❌ Critical Flaws to Eliminate:')}\n` +
      `${flawsFormatted}\n\n` +
      `${chalk.bold.cyan('🗣️ Physical Mouth / Tongue Placement Tip:')}\n` +
      `  ${aiFeedback.phoneticTips?.[0] || item.stressTip}`;

    console.log(
      boxen(scoreCard, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: aiFeedback.wordStressScore >= 80 && metrics.accuracy.accuracyScore >= 80 ? 'green' : 'yellow'
      })
    );

    if (recordedPath) {
      console.log(chalk.gray('  🎧 Post-review audio: [p] Replay my voice | [r] Replay native | [Enter] Next challenge\n'));
      while (true) {
        const postControl = (await safeInput({ message: 'Listen ([p] mine / [r] native / Enter to continue) ›' })).trim().toLowerCase();
        if (postControl === 'p') await playAudioFile(recordedPath);
        else if (postControl === 'r') await playAudio(item.sentence);
        else break;
      }
    }

    if (aiFeedback.isCorrect && metrics.accuracy.accuracyScore >= 80) {
      updateStreak(true);
      stats.recordCorrect();
    } else {
      updateStreak(false);
      stats.recordIncorrect('Phonetics / Word Stress');
      recordError('Speaking Accuracy', item.sentence, spokenText);
    }

    printDivider();
    const next = await safeConfirm({ message: 'Next pronunciation challenge?', default: true });
    if (!next) break;
  }
}

async function runSpokenQA(stats, hasMic) {
  const QA_PROMPTS = [
    {
      q: "What is your approach to handling technical debt in a fast-paced codebase?",
      focus: "Emphasize: 'prag-MAT-ic', 'prior-i-ti-ZA-tion', 'archi-TEC-tural'."
    },
    {
      q: "Tell me about a time you had to diagnose and resolve a severe production outage.",
      focus: "Emphasize: 'diag-NOSED', 'res-o-LU-tion', 'mon-i-TOR-ing'."
    },
    {
      q: "Why do you prefer clean modular architecture over monolithic spaghetti code?",
      focus: "Emphasize: 'de-COU-pled', 'main-tain-a-BIL-i-ty', 'scrip-ta-BIL-i-ty'."
    },
    {
      q: "How do you ensure clear communication during remote engineering standups?",
      focus: "Emphasize: 'col-lab-o-RA-tion', 'asyn-chro-nous-ly', 'clar-i-ty'."
    }
  ];

  const item = QA_PROMPTS[Math.floor(Math.random() * QA_PROMPTS.length)];

  clearScreen();
  printAppHeader('Spoken Tech Interview Simulation');

  console.log(
    boxen(
      `${chalk.bold.white('Interviewer Question:')}\n` +
      `"${chalk.bold.yellow(item.q)}"\n\n` +
      `${chalk.dim('Key Phonetic Targets:')} ${chalk.cyan(item.focus)}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    )
  );

  // Verbal question audio
  await playAudio(item.q);

  let spokenText;
  let durationSec = 5.0;
  let recordedPath = null;

  if (hasMic) {
    console.log(chalk.bold.yellow('  🎙️ Press Enter to START recording your response (Aim for 20-45 seconds):'));
    await safeInput({ message: 'Press Enter to Record ›' });

    const recorder = startRecording();
    const recordSpinner = ora({ text: '🔴 RECORDING ANSWER... Speak now! Press Enter when finished.', color: 'red' }).start();

    await safeInput({ message: '' });
    recordSpinner.stop();

    const result = await recorder.stop();
    durationSec = result.durationSec;
    recordedPath = result.path;

    console.log(chalk.bold.green(`\n  ✔ Audio recorded (${durationSec}s).`));
    console.log(chalk.gray('  🎧 [p] Listen to YOUR response recording | [r] Replay question | [Enter] Proceed\n'));

    while (true) {
      const playbackAction = (await safeInput({ message: 'Playback ([p] my response / [r] question / Enter to continue) ›' })).trim().toLowerCase();
      if (playbackAction === 'p') {
        console.log(chalk.cyan('  ▶ Playing your recorded voice...'));
        await playAudioFile(recordedPath);
      } else if (playbackAction === 'r') {
        await playAudio(item.q);
      } else {
        break;
      }
    }

    spokenText = (await safeInput({
      message: 'Summary/Transcript of your spoken response ›'
    })).trim();
  } else {
    spokenText = (await safeInput({
      message: 'Type your spoken response ›'
    })).trim();
  }

  if (!spokenText) return;

  const evalSpinner = ora({ text: 'Conducting strict IELTS Interview evaluation...', color: 'magenta' }).start();
  const metrics = evaluateSpeechMetrics('', spokenText, durationSec);
  const aiFeedback = await evaluateSpokenWithAI(item.q, spokenText);
  evalSpinner.stop();

  clearScreen();
  printAppHeader('Interview Speaking Assessment');

  const scorecard =
    `${chalk.bold.yellow('📊 TECHNICAL INTERVIEW SPEAKING ASSESSMENT')}\n\n` +
    `  ${chalk.dim('• Estimated IELTS Band:')}   ${chalk.bold.cyan(aiFeedback.ieltsBand || 'Band 6.5')}\n` +
    `  ${chalk.dim('• Speaking Cadence:')}         ${chalk.white(metrics.wpm.label)}\n` +
    `  ${chalk.dim('• Word Stress Quality:')}      ${chalk.green(aiFeedback.wordStressScore + '/100')}\n` +
    `  ${chalk.dim('• Filler Words / Pauses:')}    ${metrics.fillers.count === 0 ? chalk.green('0 (Clean & Direct 🔥)') : chalk.yellow(`${metrics.fillers.count} (${metrics.fillers.detected.join(', ')})`)}\n\n` +
    `${chalk.bold.white('🔍 Examiner Diagnostic:')}\n` +
    `  ${aiFeedback.feedback}\n\n` +
    `${chalk.bold.cyan('✨ More Natural Senior Phrasing:')}\n` +
    `  "${chalk.italic.white(aiFeedback.suggestions?.[0] || spokenText)}"`;

  console.log(
    boxen(scorecard, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'green'
    })
  );

  if (recordedPath) {
    while (true) {
      const replayControl = (await safeInput({ message: 'Listen ([p] my response / Enter to return) ›' })).trim().toLowerCase();
      if (replayControl === 'p') await playAudioFile(recordedPath);
      else break;
    }
  }

  if (aiFeedback.isCorrect) {
    updateStreak(true);
    stats.recordCorrect();
  } else {
    stats.recordIncorrect('Spoken Grammar');
  }

  await safeConfirm({ message: 'Return to Speaking Menu?', default: true });
}
