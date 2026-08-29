import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import {
  ROLE_PRESETS,
  SENIORITY_LEVELS,
  COMPANY_PROFILES,
  generateInterviewQuestions,
  calculateHiringVerdict,
  generateHiringBoardReport
} from '../services/interview.js';
import { isRecorderAvailable, startRecording } from '../services/recorder.js';
import { isTranscriptionAvailable, transcribeAudio } from '../services/transcriber.js';
import { calculateWpm } from '../services/speech.js';
import { updateStreak } from '../services/history.js';
import { playAudio, playAudioFile } from '../services/audio.js';
import { clearScreen, printAppHeader, printDivider } from '../ui/display.js';
import { safeSelect, safeInput, safeConfirm } from '../ui/prompt.js';

export async function runTechInterview(stats) {
  clearScreen();
  printAppHeader('Personalized Tech Mock Interview');

  console.log(
    boxen(
      `${chalk.bold.cyan('💼 US Tech Remote Hiring Simulator')}\n\n` +
      `${chalk.white('Practice 4 high-stakes technical interview rounds tailored to YOUR specific role, tech stack, and target company profile.')}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan'
      }
    )
  );

  // Step 1: Role Selection
  console.log(chalk.bold.yellow('  [1/4] Select Target Engineering Discipline (Esc to return):'));
  const roleChoices = [
    { name: '🔙 Back to Main Menu', value: 'BACK' },
    ...ROLE_PRESETS.map((r) => ({ name: r.title, value: r })),
    { name: '✏️  Custom Role (Type your own title & stack)', value: 'CUSTOM' }
  ];

  const selectedRole = await safeSelect({
    message: 'Choose your role:',
    choices: roleChoices
  });

  if (!selectedRole || selectedRole === 'BACK') return;

  let roleTitle;
  let techStack;

  if (selectedRole === 'CUSTOM') {
    roleTitle = (await safeInput({
      message: 'Enter your exact Job Title (e.g. Senior Data Platform Engineer) ›',
      default: 'Senior Software Engineer'
    })).trim();

    techStack = (await safeInput({
      message: 'Enter your Core Technologies (comma separated) ›',
      default: 'TypeScript, Node.js, PostgreSQL, Docker, AWS'
    })).trim();
  } else {
    roleTitle = selectedRole.title.replace(/^[^\s]+\s*/, '');
    techStack = (await safeInput({
      message: 'Confirm or customize your Tech Stack ›',
      default: selectedRole.defaultStack
    })).trim() || selectedRole.defaultStack;
  }

  // Step 2: Seniority
  console.log(chalk.bold.yellow('\n  [2/4] Seniority Level:'));
  const seniorityChoice = await safeSelect({
    message: 'Select target seniority:',
    choices: SENIORITY_LEVELS.map((s) => ({ name: s.title, value: s.title }))
  });

  if (!seniorityChoice) return;

  // Step 3: Company Profile
  console.log(chalk.bold.yellow('\n  [3/4] Target Company Profile:'));
  const companyChoice = await safeSelect({
    message: 'Select company type:',
    choices: COMPANY_PROFILES.map((c) => ({ name: c.title, value: c.title }))
  });

  if (!companyChoice) return;

  const profile = {
    roleTitle,
    techStack,
    seniority: seniorityChoice,
    companyProfile: companyChoice
  };

  // Step 4: Generate tailored questions
  clearScreen();
  printAppHeader('Interview Preparation');

  const genSpinner = ora({
    text: `Generating 4 tailored interview questions for ${chalk.bold.cyan(profile.roleTitle)}...`,
    color: 'magenta'
  }).start();

  const questions = await generateInterviewQuestions(profile);
  genSpinner.stop();

  console.log(
    boxen(
      `${chalk.bold.green('✔ Interview Agenda Ready!')}\n\n` +
      `  ${chalk.dim('• Target Candidate:')} ${chalk.cyan(profile.roleTitle)} (${chalk.yellow(profile.seniority)})\n` +
      `  ${chalk.dim('• Tech Stack:')}        ${chalk.white(profile.techStack)}\n` +
      `  ${chalk.dim('• Company Type:')}      ${chalk.white(profile.companyProfile)}\n\n` +
      `${chalk.bold.white('4 Interview Rounds:')}\n` +
      questions.map((q) => `  ${chalk.bold.yellow(`Round ${q.round}:`)} ${q.title}`).join('\n'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    )
  );

  const startConfirm = await safeConfirm({ message: 'Start the interview now?', default: true });
  if (!startConfirm) return;

  // Run the 4 Rounds
  const roundsData = [];
  const hasMic = isRecorderAvailable();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    clearScreen();
    printAppHeader(`Interview Round ${q.round}/4 • ${q.title}`);

    const targets = q.samplePoints && q.samplePoints.length > 0
      ? q.samplePoints.map((p) => `  ${chalk.cyan('•')} ${p}`).join('\n')
      : '  • Clear architectural reasoning & STAR structure';

    console.log(
      boxen(
        `${chalk.bold.yellow('🎙️ Interviewer Question:')}\n` +
        `"${chalk.bold.white(q.question)}"\n\n` +
        `${chalk.bold.white('Key Technical Rubric:')}\n` +
        `  ${chalk.gray(q.rubric)}\n\n` +
        `${chalk.bold.white('High-Impact Target Concepts:')}\n` +
        `${targets}`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'yellow'
        }
      )
    );

    // Play interviewer audio
    console.log(chalk.gray('  🔊 Interviewer is asking the question verbally...\n'));
    await playAudio(q.question);

    let spokenText;
    let durationSec = 10.0;
    let recordedPath;
    let transcriptSource = 'self-reported';

    if (hasMic) {
      console.log(chalk.bold.yellow('\n  🎙️ Press Enter to START recording your answer (Aim for 30-60 seconds):'));
      await safeInput({ message: 'Press Enter to Record ›' });

      const recorder = startRecording();
      const recordSpinner = ora({ text: '🔴 RECORDING YOUR ANSWER... Speak now! Press Enter when finished.', color: 'red' }).start();

      await safeInput({ message: '' });
      recordSpinner.stop();

      const result = await recorder.stop();
      durationSec = result.durationSec;
      recordedPath = result.path;

      console.log(chalk.bold.green(`\n  ✔ Audio recorded (${durationSec}s).`));
      console.log(chalk.gray('  🎧 [p] Listen to your recording | [r] Replay question | [Enter] Continue\n'));

      while (true) {
        const playbackAction = (await safeInput({ message: 'Playback ([p] my response / [r] question / Enter to continue) ›' })).trim().toLowerCase();
        if (playbackAction === 'p') {
          console.log(chalk.cyan('  ▶ Playing your recorded voice...'));
          await playAudioFile(recordedPath);
        } else if (playbackAction === 'r') {
          await playAudio(q.question);
        } else {
          break;
        }
      }

      let stt = null;
      if (isTranscriptionAvailable()) {
        const sttSpinner = ora({
          text: '🧠 Transcribing your answer...',
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
        // Wall-clock includes the pause before you start answering; the
        // measured speech span is what the fluency score should be built on.
        if (stt.speechDurationSec > 0) durationSec = stt.speechDurationSec;
        spokenText = stt.text;

        console.log(`\n  ${chalk.dim('👂 What the engine heard:')}\n  ${chalk.white(`"${spokenText}"`)}\n`);
      } else {
        console.log(
          chalk.yellow('\n  ⚠ No transcript — the committee will score a summary you typed, not your speech.\n')
        );
        spokenText = (await safeInput({
          message: 'Type what you actually said ›'
        })).trim();
      }
    } else {
      spokenText = (await safeInput({
        message: 'Type your spoken response ›'
      })).trim();
    }

    if (!spokenText) spokenText = 'No detailed response provided.';

    const words = spokenText.split(/\s+/).filter(Boolean).length;
    const wpmData = calculateWpm(words, durationSec);

    console.log(
      `  ${chalk.dim('• Speaking Cadence:')}   ${chalk.white(wpmData.label)}  ` +
      (transcriptSource === 'self-reported'
        ? chalk.yellow('(self-reported ⚠)')
        : chalk.green(`(${transcriptSource} ✔ measured)`))
    );

    roundsData.push({
      round: q.round,
      title: q.title,
      question: q.question,
      answer: spokenText,
      wpm: wpmData.wpm,
      transcriptSource
    });

    printDivider();
    if (i < questions.length - 1) {
      const nextRound = await safeConfirm({ message: 'Proceed to next round?', default: true });
      if (!nextRound) break;
    }
  }

  // Generate Hiring Board Decision
  clearScreen();
  printAppHeader('Hiring Committee Deliberation');

  const evalSpinner = ora({
    text: 'Hiring Committee is reviewing your transcripts and technical depth...',
    color: 'magenta'
  }).start();

  const report = await generateHiringBoardReport(profile, roundsData);
  evalSpinner.stop();

  const verdict = calculateHiringVerdict(report.overallAverage || 75);

  clearScreen();
  printAppHeader('Hiring Committee Final Decision');

  const strengthsList = report.keyStrengths?.map((s) => `  ${chalk.green('✔')} ${s}`).join('\n') || '  ✔ Strong technical terminology';
  const redFlagsList = report.redFlagsOrWeaknesses?.map((w) => `  ${chalk.red('✖')} ${w}`).join('\n') || '  ✖ Practice more concise incident explanations';

  const scorecard =
    `${chalk.bold.yellow('🏛️  HIRING COMMITTEE OFFICIAL DECISION')}\n\n` +
    `  ${chalk.dim('• Target Candidate:')}    ${profile.roleTitle} (${profile.seniority})\n` +
    `  ${chalk.dim('• Overall Verdict:')}      ${chalk.bold(verdict)}\n` +
    `  ${chalk.dim('• Overall Rating:')}       ${chalk.bold.white((report.overallAverage || 75) + '/100')}\n\n` +
    `${chalk.bold.white('📊 Competency Scores:')}\n` +
    `  • Technical Depth & Stack Mastery:   ${chalk.cyan((report.technicalDepthScore || 80) + '/100')}\n` +
    `  • Spoken English & Fluency (CEFR):   ${chalk.cyan((report.spokenEnglishScore || 78) + '/100')}\n` +
    `  • STAR Structure & Conflict Triage:  ${chalk.cyan((report.starStructureScore || 75) + '/100')}\n\n` +
    `${chalk.bold.white('📋 Executive Committee Summary:')}\n` +
    `  ${report.executiveSummary}\n\n` +
    `${chalk.bold.green('🌟 Key Strengths:')}\n` +
    `${strengthsList}\n\n` +
    `${chalk.bold.red('⚠️ Areas to Polish:')}\n` +
    `${redFlagsList}\n\n` +
    `${chalk.bold.cyan('🎯 Actionable Drill:')}\n` +
    `  ${report.recommendedDrill}`;

  console.log(
    boxen(scorecard, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: (report.overallAverage || 75) >= 75 ? 'green' : 'yellow'
    })
  );

  if ((report.overallAverage || 75) >= 65) {
    updateStreak(true);
    stats.recordCorrect();
  } else {
    updateStreak(false);
    stats.recordIncorrect('Technical Interview Practice');
  }

  await safeConfirm({ message: 'Finish Interview & Return to Menu?', default: true });
}
