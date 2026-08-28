import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { isRecorderAvailable, startRecording } from '../services/recorder.js';
import { evaluateSpeechMetrics, evaluateSpokenWithAI } from '../services/speech.js';
import { updateStreak, recordError } from '../services/history.js';
import { playAudio, playAudioSlow, playAudioUltraSlow, playAudioFile } from '../services/audio.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeConfirm, safeInput } from '../ui/prompt.js';

const PRACTICE_SENTENCES = [
  {
    level: 'A2',
    sentence: "I'm looking forward to collaborating with your engineering team.",
    phonetics: "aɪm ˈlʊkɪŋ ˈfɔːrwərd tuː kəˈlæbəˌreɪtɪŋ wɪð jɔːr ˌɛnʤɪˈnɪrɪŋ tiːm",
    stressTip: "Stress: 'col-LAB-orating' and 'engi-NEER-ing'. Link: 'look-ing_forward_to'."
  },
  {
    level: 'B1',
    sentence: "We should prioritize resolving this critical production outage immediately.",
    phonetics: "wiː ʃʊd praɪˈɔːrɪˌtaɪz rɪˈzɑːlvɪŋ ðɪs ˈkrɪtɪkəl prəˈdʌkʃən ˈaʊtɪʤ ɪˈmiːdiətli",
    stressTip: "Stress: 'pri-OR-i-tize' and 'im-ME-diate-ly'. Soft reduction on 'should'."
  },
  {
    level: 'B2',
    sentence: "Had we implemented automated testing earlier, we would have avoided this bug.",
    phonetics: "hæd wiː ˈɪmpləˌmɛntɪd ˈɔːtəˌmeɪtɪd ˈtɛstɪŋ ˈɜːrliər wiː wʊd hæv əˈvɔɪdɪd ðɪs bʌɡ",
    stressTip: "Inverted conditional: Emphasize 'IM-plemented' and 'a-VOID-ed'."
  },
  {
    level: 'C1',
    sentence: "Not only does the new architecture reduce latency, but it also scales seamlessly.",
    phonetics: "nɑːt ˈoʊnli dʌz ðə nuː ˈɑːrkəˌtɛkʧər rɪˈduːs ˈleɪtənsi bʌt ɪt ˈɔːlsoʊ skeɪlz ˈsiːmləsli",
    stressTip: "Negative fronting: Strong cadence on 'Not ON-ly', 'LA-tency' and 'SEAM-less-ly'."
  }
];

export async function runSpeakingLab(stats) {
  while (true) {
    clearScreen();
    printAppHeader('Speaking & Pronunciation Lab');

    const hasMic = isRecorderAvailable();
    const micStatus = hasMic
      ? chalk.green('✔ Microphone Available (Hardware Capture Ready)')
      : chalk.yellow('⚠ No Microphone Detected (Text Simulation Mode)');

    console.log(
      boxen(
        `${chalk.bold.white('Speech & Fluency Training:')}\n\n` +
        `  ${chalk.dim('• Hardware Status:')} ${micStatus}\n` +
        `  ${chalk.dim('• Self-Playback:')}   [p] Play YOUR recorded voice anytime to self-assess 🎧\n` +
        `  ${chalk.dim('• Metrics Tracked:')}  WPM Speed, Word Accuracy, Fluency %, Filler Detection\n` +
        `  ${chalk.dim('• Audio Playback:')}  1.0x Normal, 0.7x Slow, 0.4x Phonetic Breakdown`,
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
        { name: '🗣️  Read & Pronounce (Fluency & Speed Workout)', value: 'PRONOUNCE' },
        { name: '💬 Spoken Q&A Simulation (Conversational Fluency)', value: 'QA' }
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

    const card =
      `${chalk.bold.white('Target Sentence:')}\n` +
      `"${chalk.bold.cyan(item.sentence)}"\n\n` +
      `${chalk.dim('IPA Phonetics:')}  ${chalk.gray(item.phonetics)}\n` +
      `${chalk.dim('Stress & Rhythm:')} ${chalk.yellow(item.stressTip)}`;

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
      const audioControl = (await safeInput({ message: 'Listen again ([r]/[s]/[u]) or press Enter to speak ›' })).trim().toLowerCase();
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

      console.log(chalk.bold.green(`\n  ✔ Audio recorded (${durationSec}s).`));
      console.log(chalk.gray('  🎧 [p] Listen to YOUR recording | [r] Replay native audio | [Enter] Proceed\n'));

      while (true) {
        const playbackAction = (await safeInput({ message: 'Audio playback ([p] my voice / [r] native / Enter to continue) ›' })).trim().toLowerCase();
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
        message: 'Confirm what you spoke (or adjust transcript) ›',
        default: item.sentence
      })).trim();
    } else {
      spokenText = (await safeInput({
        message: 'Type the sentence as you spoke it (Simulation) ›'
      })).trim();
    }

    if (!spokenText) continue;

    // Evaluate Metrics
    const metrics = evaluateSpeechMetrics(item.sentence, spokenText, durationSec);
    const evalSpinner = ora({ text: 'Analyzing speech rhythm and phonetics...', color: 'magenta' }).start();
    const aiFeedback = await evaluateSpokenWithAI('Read aloud practice', spokenText, item.sentence);
    evalSpinner.stop();

    clearScreen();
    printAppHeader('Speaking Scorecard');

    const scoreCard =
      `${chalk.bold.white('🎯 Pronunciation & Fluency Scorecard:')}\n\n` +
      `  ${chalk.dim('• Speaking Speed:')}    ${chalk.bold.cyan(metrics.wpm.label)}\n` +
      `  ${chalk.dim('• Word Accuracy:')}    ${metrics.accuracy.accuracyScore >= 90 ? chalk.bold.green(metrics.accuracy.accuracyScore + '% ✔') : chalk.bold.yellow(metrics.accuracy.accuracyScore + '%')}\n` +
      `  ${chalk.dim('• Fluency Score:')}    ${chalk.bold.green(metrics.fluencyScore + '/100')}\n` +
      `  ${chalk.dim('• Hesitations/Fillers:')} ${metrics.fillers.count === 0 ? chalk.green('0 (Clean speech 🔥)') : chalk.yellow(`${metrics.fillers.count} detected: ${metrics.fillers.detected.join(', ')}`)}\n\n` +
      `${chalk.bold.yellow('💡 Coach Advice:')}\n` +
      `  ${aiFeedback.feedback}\n\n` +
      `${chalk.bold.white('🗣️ Phonetic Tip:')}\n` +
      `  ${aiFeedback.pronunciationTips?.[0] || item.stressTip}`;

    console.log(
      boxen(scoreCard, {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: metrics.accuracy.accuracyScore >= 80 ? 'green' : 'yellow'
      })
    );

    if (recordedPath) {
      console.log(chalk.gray('  🎧 Controls: [p] Replay your recording | [r] Replay native model | [Enter] Next\n'));
      while (true) {
        const postControl = (await safeInput({ message: 'Listen ([p] my voice / [r] native / Enter to finish) ›' })).trim().toLowerCase();
        if (postControl === 'p') await playAudioFile(recordedPath);
        else if (postControl === 'r') await playAudio(item.sentence);
        else break;
      }
    }

    if (metrics.accuracy.accuracyScore >= 80) {
      updateStreak(true);
      stats.recordCorrect();
    } else {
      updateStreak(false);
      stats.recordIncorrect('Pronunciation / Speech');
      recordError('Speaking Accuracy', item.sentence, spokenText);
    }

    printDivider();
    const next = await safeConfirm({ message: 'Next pronunciation challenge?', default: true });
    if (!next) break;
  }
}

async function runSpokenQA(stats, hasMic) {
  const QA_PROMPTS = [
    "What is your approach to handling technical debt in a codebase?",
    "Tell me about a time you had to debug a difficult production issue.",
    "Why do you prefer clean architecture over monolithic spaghetti code?",
    "How do you ensure good communication during remote team standups?"
  ];

  const prompt = QA_PROMPTS[Math.floor(Math.random() * QA_PROMPTS.length)];

  clearScreen();
  printAppHeader('Spoken Q&A Simulation');

  console.log(
    boxen(
      `${chalk.bold.white('Interviewer Question:')}\n` +
      `"${chalk.bold.yellow(prompt)}"`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'yellow'
      }
    )
  );

  // Verbal question audio
  await playAudio(prompt);

  let spokenText;
  let durationSec = 5.0;
  let recordedPath = null;

  if (hasMic) {
    console.log(chalk.bold.yellow('  🎙️ Press Enter to START recording your response (Aim for 20-40 seconds):'));
    await safeInput({ message: 'Press Enter to Record ›' });

    const recorder = startRecording();
    const recordSpinner = ora({ text: '🔴 RECORDING YOUR ANSWER... Press Enter when finished.', color: 'red' }).start();

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
        await playAudio(prompt);
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

  const evalSpinner = ora({ text: 'Evaluating spoken grammar and vocabulary...', color: 'magenta' }).start();
  const metrics = evaluateSpeechMetrics('', spokenText, durationSec);
  const aiFeedback = await evaluateSpokenWithAI(prompt, spokenText);
  evalSpinner.stop();

  clearScreen();
  printAppHeader('Interview Speaking Assessment');

  const scorecard =
    `${chalk.bold.white('📊 Spoken English Assessment:')}\n\n` +
    `  ${chalk.dim('• Pace & Rhythm:')}      ${chalk.cyan(metrics.wpm.label)}\n` +
    `  ${chalk.dim('• Grammar Score:')}      ${chalk.green(aiFeedback.grammarScore + '/100')}\n` +
    `  ${chalk.dim('• Filler Words:')}       ${metrics.fillers.count === 0 ? chalk.green('0 (Super clear!)') : chalk.yellow(`${metrics.fillers.count} (${metrics.fillers.detected.join(', ')})`)}\n\n` +
    `${chalk.bold.yellow('💡 Interviewer Feedback:')}\n` +
    `  ${aiFeedback.feedback}\n\n` +
    `${chalk.bold.cyan('✨ More Natural Phrasing:')}\n` +
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
