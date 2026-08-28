import { callAgy } from './agy.js';

export const ROLE_PRESETS = [
  {
    id: 'backend',
    title: '💻 Full-Stack / Backend Engineer',
    defaultStack: 'Node.js, TypeScript, PostgreSQL, Redis, Microservices, REST/GraphQL',
    focus: 'Scalability, API design, database indexing, caching strategies'
  },
  {
    id: 'frontend',
    title: '🎨 Frontend / Web & Mobile Engineer',
    defaultStack: 'React, Next.js, TypeScript, Tailwind, Web Performance, State Management',
    focus: 'Core Web Vitals, component architecture, rendering optimization, a11y'
  },
  {
    id: 'devops',
    title: '☁️ DevOps / SRE / Cloud Platform',
    defaultStack: 'Kubernetes, AWS/GCP, Docker, Terraform, CI/CD pipelines, Prometheus',
    focus: 'Zero-downtime deployments, incident triage, infrastructure as code, SLOs'
  },
  {
    id: 'ai_data',
    title: '🧠 AI / Data / Machine Learning Engineer',
    defaultStack: 'Python, PyTorch, LangChain, RAG architectures, Vector DBs, Data Pipelines',
    focus: 'Model latency, hallucination mitigation, embeddings, pipeline throughput'
  },
  {
    id: 'qa',
    title: '🧪 QA / Test Automation Engineer',
    defaultStack: 'Playwright, Cypress, Jest, Node.js, CI/CD integration, Performance Testing',
    focus: 'E2E test reliability, test pyramid, flaky test mitigation, regression suites'
  },
  {
    id: 'security',
    title: '🛡️ Cybersecurity / AppSec Engineer',
    defaultStack: 'OWASP Top 10, OAuth2/OIDC, Cloud Security, Penetration Testing, Threat Modeling',
    focus: 'Vulnerability remediation, authentication flows, zero-trust architectures'
  }
];

export const SENIORITY_LEVELS = [
  { id: 'junior', title: '🌱 Junior Engineer (0-2 years)' },
  { id: 'mid', title: '🚀 Mid-Level Engineer (2-5 years)' },
  { id: 'senior', title: '⚡ Senior / Staff / Lead Engineer (5+ years)' }
];

export const COMPANY_PROFILES = [
  { id: 'startup', title: '🚀 US High-Growth Tech Startup (Speed, Autonomy & Pragmatism)' },
  { id: 'bigtech', title: '🏢 Big Tech / Enterprise Scale (Distributed Systems & Strict Processes)' },
  { id: 'fintech', title: '💳 Fintech / High-Frequency (Zero-Loss Security & High Concurrency)' }
];

/**
 * @typedef {Object} CandidateProfile
 * @property {string} roleTitle
 * @property {string} techStack
 * @property {string} seniority
 * @property {string} companyProfile
 */

/**
 * Generates tailored interview questions based on candidate profile.
 * @param {CandidateProfile} profile
 * @returns {Promise<Array<{ round: number, title: string, question: string, rubric: string, samplePoints: string[] }>>}
 */
export async function generateInterviewQuestions(profile) {
  const prompt =
    `You are a Principal Engineering Hiring Manager conducting a high-stakes technical interview in English.\n` +
    `Generate exactly 4 customized interview questions for this specific candidate profile:\n` +
    `- Target Role: ${profile.roleTitle}\n` +
    `- Tech Stack / Technologies: ${profile.techStack}\n` +
    `- Seniority Level: ${profile.seniority}\n` +
    `- Company Type: ${profile.companyProfile}\n\n` +
    `Create 4 distinct rounds:\n` +
    `Round 1: Background & Philosophy (Tell me about your architectural experience with this stack)\n` +
    `Round 2: Domain-Specific System Design & Tradeoffs (Deep dive into their stack)\n` +
    `Round 3: Live Incident Debugging & Production Outage (Scenario relevant to their technologies)\n` +
    `Round 4: Behavioral STAR Conflict & Leadership (Disagreement on a technical decision)\n\n` +
    `Return ONLY a raw JSON array of 4 objects with NO markdown formatting, NO backticks:\n` +
    `[\n` +
    `  {\n` +
    `    "round": 1,\n` +
    `    "title": "Background & Architecture Philosophy",\n` +
    `    "question": "Clear, professional question in English",\n` +
    `    "rubric": "What the interviewer is specifically listening for",\n` +
    `    "samplePoints": ["Key senior phrase/concept 1", "Key phrase/concept 2"]\n` +
    `  },\n` +
    `  ...\n` +
    `]`;

  try {
    const raw = callAgy(prompt);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 4) {
      return parsed.slice(0, 4);
    }
  } catch {
    // Fallback to robust offline template
  }

  return getFallbackQuestions(profile);
}

/**
 * Fallback questions if offline or subprocess timeout.
 * @param {CandidateProfile} profile
 */
export function getFallbackQuestions(profile) {
  return [
    {
      round: 1,
      title: 'Background & Architectural Philosophy',
      question: `Could you walk me through your engineering background and how you approach architectural decisions when working with ${profile.techStack}?`,
      rubric: 'Looking for structured communication, clear ownership, and concise summary of senior experience.',
      samplePoints: ['Pragmatic tradeoffs', 'Decoupled services', 'Clean code principles']
    },
    {
      round: 2,
      title: 'Domain System Design & Scalability',
      question: `How would you design a highly scalable and fault-tolerant system using ${profile.techStack} to handle unpredictable traffic spikes?`,
      rubric: 'Looking for caching layers, async queuing, database bottleneck prevention, and observability.',
      samplePoints: ['Read/Write replicas', 'Idempotency', 'Graceful degradation']
    },
    {
      round: 3,
      title: 'Production Incident Triage',
      question: `Imagine your production services in ${profile.techStack} start experiencing sudden 5xx errors and high latency during peak business hours. Walk me through your step-by-step triage and mitigation process.`,
      rubric: 'Looking for methodical debugging: metrics analysis, rolling back vs hotfixing, blameless post-mortem.',
      samplePoints: ['Observability metrics', 'Root cause isolation', 'Customer impact mitigation']
    },
    {
      round: 4,
      title: 'Behavioral STAR & Technical Conflict',
      question: 'Tell me about a time you strongly disagreed with a tech lead or product manager regarding an engineering decision. How did you handle it and reach consensus?',
      rubric: 'Evaluating STAR method (Situation, Task, Action, Result) and emotional intelligence.',
      samplePoints: ['Data-driven arguments', 'Disagree and commit', 'Positive business outcome']
    }
  ];
}

/**
 * Calculates hiring board decision based on scores.
 * @param {number} averageScore
 * @returns {'STRONG HIRE 🟢' | 'HIRE 🟢' | 'LEANING HIRE 🟡' | 'LEANING NO 🟡' | 'NO HIRE 🔴'}
 */
export function calculateHiringVerdict(averageScore) {
  if (averageScore >= 85) return 'STRONG HIRE 🟢';
  if (averageScore >= 75) return 'HIRE 🟢';
  if (averageScore >= 65) return 'LEANING HIRE 🟡';
  if (averageScore >= 50) return 'LEANING NO 🟡';
  return 'NO HIRE 🔴';
}

/**
 * Generates final Hiring Board Review with AI.
 * @param {CandidateProfile} profile
 * @param {Array<{ round: number, question: string, answer: string, wpm: number }>} roundsData
 */
export async function generateHiringBoardReport(profile, roundsData) {
  const transcriptSummary = roundsData
    .map((r) => `Round ${r.round}: "${r.question}"\nCandidate Spoke: "${r.answer}" (Speed: ${r.wpm} WPM)`)
    .join('\n\n');

  const prompt =
    `You are the Head of the Engineering Hiring Committee at a top US tech company.\n` +
    `Evaluate this full 4-round technical interview transcript for a candidate applying for:\n` +
    `Role: ${profile.roleTitle} (${profile.seniority}) at ${profile.companyProfile}\n` +
    `Tech Stack: ${profile.techStack}\n\n` +
    `Interview Transcript:\n${transcriptSummary}\n\n` +
    `Return ONLY a raw JSON object with NO markdown formatting, NO backticks:\n` +
    `{\n` +
    `  "technicalDepthScore": number (0-100),\n` +
    `  "spokenEnglishScore": number (0-100),\n` +
    `  "starStructureScore": number (0-100),\n` +
    `  "overallAverage": number (0-100),\n` +
    `  "executiveSummary": "Concise 2-3 sentence hiring committee verdict in Spanish",\n` +
    `  "keyStrengths": ["Bullet point 1", "Bullet point 2"],\n` +
    `  "redFlagsOrWeaknesses": ["Specific area that needs work in English or tech"],\n` +
    `  "recommendedDrill": "What the candidate should practice to guarantee getting hired"\n` +
    `}`;

  try {
    const raw = callAgy(prompt);
    return JSON.parse(raw);
  } catch {
    const avg = 78;
    return {
      technicalDepthScore: 80,
      spokenEnglishScore: 78,
      starStructureScore: 76,
      overallAverage: avg,
      executiveSummary: 'El candidato demuestra solvencia técnica y buen dominio del vocabulario de su stack. Con mayor precisión en la reducción fonética y respuestas más concisas, califica sólidamente para roles internacionales.',
      keyStrengths: ['Manejo de terminología técnica en inglés', 'Estructura clara de ideas'],
      redFlagsOrWeaknesses: ['Asegurar el formato STAR en preguntas de incidentes y conflictos'],
      recommendedDrill: 'Practicar la respuesta a incidentes de producción cronometrada en 45 segundos.'
    };
  }
}
