import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { isRecorderAvailable, startRecording } from '../services/recorder.js';
import { evaluateSpeechMetrics, evaluateSpokenWithAI } from '../services/speech.js';
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
    const micStatus = hasMic
      ? chalk.green('✔ Microphone Active (Acoustic Capture Ready)')
      : chalk.yellow('⚠ No Microphone Detected (Text Simulation Mode)');

    console.log(
      boxen(
        `${chalk.bold.white('Strict IELTS/TOEFL Speech & Acoustic Evaluation:')}\n\n` +
        `  ${chalk.dim('• Hardware Status:')}  ${micStatus}\n` +
        `  ${chalk.dim('• Acoustic Checks:')}  Word Stress, Silent Letters, Minimal Pairs, S-Cluster Epenthesis\n` +
        `  ${chalk.dim('• Self-Monitoring:')}  [p] Play YOUR recording ➔ Compare with [r] Native Model\n` +
        `  ${chalk.dim('• Scoring Rubric:')}   IELTS Band, WPM Speed Meter, Connected Speech Score`,
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

      spokenText = (await safeInput({
        message: 'Confirm what you spoke (or adjust transcript if you missed words) ›',
        default: item.sentence
      })).trim();
    } else {
      spokenText = (await safeInput({
        message: 'Type the sentence as you spoke it (Simulation) ›'
      })).trim();
    }

    if (!spokenText) continue;

    // Strict AI Diagnostic Evaluation
    const metrics = evaluateSpeechMetrics(item.sentence, spokenText, durationSec);
    const evalSpinner = ora({ text: 'Conducting strict IELTS/TOEFL acoustic & phonetic audit...', color: 'magenta' }).start();
    const aiFeedback = await evaluateSpokenWithAI('Read aloud strict practice', spokenText, item.sentence);
    evalSpinner.stop();

    clearScreen();
    printAppHeader('IELTS Diagnostic Speech Scorecard');

    const flawsFormatted = aiFeedback.criticalFlaws && aiFeedback.criticalFlaws.length > 0
      ? aiFeedback.criticalFlaws.map((f) => `  ${chalk.red('✖')} ${chalk.yellow(f)}`).join('\n')
      : `  ${chalk.green('✔ No critical phonetic transfer errors detected.')}`;

    const scoreCard =
      `${chalk.bold.yellow('📋 STRICT IELTS/TOEFL DIAGNOSTIC SCORECARD')}\n\n` +
      `  ${chalk.dim('• Estimated Level:')}        ${chalk.bold.cyan(aiFeedback.ieltsBand || 'Band 6.5')}\n` +
      `  ${chalk.dim('• Speaking Cadence:')}       ${chalk.bold.white(metrics.wpm.label)}\n` +
      `  ${chalk.dim('• Word Stress Score:')}      ${aiFeedback.wordStressScore >= 80 ? chalk.green(`${aiFeedback.wordStressScore}/100 ✔`) : chalk.yellow(`${aiFeedback.wordStressScore}/100 ⚠`)}\n` +
      `  ${chalk.dim('• Connected Speech Score:')}  ${aiFeedback.connectedSpeechScore >= 80 ? chalk.green(`${aiFeedback.connectedSpeechScore}/100 ✔`) : chalk.yellow(`${aiFeedback.connectedSpeechScore}/100 ⚠`)}\n` +
      `  ${chalk.dim('• Word Precision:')}         ${metrics.accuracy.accuracyScore >= 90 ? chalk.green(`${metrics.accuracy.accuracyScore}% ✔`) : chalk.yellow(`${metrics.accuracy.accuracyScore}%`)}\n\n` +
      `${chalk.bold.white('🔍 Examiner Phonetic Audit:')}\n` +
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
