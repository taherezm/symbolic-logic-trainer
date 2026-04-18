export type SkillKey =
  | 'sentence-letters'
  | 'negation'
  | 'conjunction'
  | 'disjunction'
  | 'conditionals'
  | 'biconditionals'
  | 'translation'
  | 'validity'
  | 'proofs';

export type StageId =
  | 'sentence-letters'
  | 'negation'
  | 'conjunction'
  | 'disjunction'
  | 'conditionals'
  | 'biconditionals'
  | 'mixed-truth'
  | 'simple-translation'
  | 'conditional-translation'
  | 'validity-basics'
  | 'proof-basics';

export const STAGE_ORDER: StageId[] = [
  'sentence-letters',
  'negation',
  'conjunction',
  'disjunction',
  'conditionals',
  'biconditionals',
  'mixed-truth',
  'simple-translation',
  'conditional-translation',
  'validity-basics',
  'proof-basics',
];

export const STAGE_LABELS: Record<StageId, string> = {
  'sentence-letters': 'Sentence Letters',
  negation: 'Negation',
  conjunction: 'Conjunction',
  disjunction: 'Disjunction',
  conditionals: 'Conditionals',
  biconditionals: 'Biconditionals',
  'mixed-truth': 'Mixed Truth Values',
  'simple-translation': 'Simple Translation',
  'conditional-translation': 'Conditional Translation',
  'validity-basics': 'Validity Basics',
  'proof-basics': 'Proof Basics',
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  'sentence-letters': 'Sentence Letters',
  negation: 'Negation',
  conjunction: 'Conjunction',
  disjunction: 'Disjunction',
  conditionals: 'Conditionals',
  biconditionals: 'Biconditionals',
  translation: 'Translation',
  validity: 'Validity',
  proofs: 'Proofs',
};

export type ExerciseType =
  | 'truth-value'
  | 'english-to-symbolic'
  | 'symbolic-to-english'
  | 'validity'
  | 'proof-step';

export type LegendEntry = {
  symbol: string;
  meaning: string;
};

export type MultipleChoiceOption = {
  id: string;
  label: string;
  feedback: string;
};

export type CommonMistake = {
  formula: string;
  feedback: string;
};

type ExerciseBase = {
  id: string;
  type: ExerciseType;
  stage: StageId;
  title: string;
  prompt: string;
  skills: SkillKey[];
  difficulty: 1 | 2 | 3;
};

export type TruthValueExercise = ExerciseBase & {
  type: 'truth-value';
  formula: string;
  assignment: Record<string, boolean>;
};

export type EnglishToSymbolicExercise = ExerciseBase & {
  type: 'english-to-symbolic';
  sentence: string;
  legend: LegendEntry[];
  acceptedFormulas: string[];
  commonMistakes: CommonMistake[];
};

export type SymbolicToEnglishExercise = ExerciseBase & {
  type: 'symbolic-to-english';
  formula: string;
  legend: LegendEntry[];
  options: MultipleChoiceOption[];
  correctOptionId: string;
};

export type ValidityExercise = ExerciseBase & {
  type: 'validity';
  premises: string[];
  conclusion: string;
  argumentLabel: string;
  fallacyName?: string;
};

export type ProofStepExercise = ExerciseBase & {
  type: 'proof-step';
  premises: string[];
  derived?: string[];
  goal: string;
  options: MultipleChoiceOption[];
  correctOptionId: string;
};

export type Exercise =
  | TruthValueExercise
  | EnglishToSymbolicExercise
  | SymbolicToEnglishExercise
  | ValidityExercise
  | ProofStepExercise;

export type ExerciseRecord = Exercise & {
  sequence: number;
};

export type ExerciseOutcome = {
  correct: boolean;
  feedback: string;
  expected?: string;
  parsedAnswer?: string;
};

export type ItemProgress = {
  attempts: number;
  correct: number;
  streak: number;
  dueTurn: number;
  lastSeenTurn: number;
  lastCorrect: boolean;
};

export type SkillProgress = {
  attempts: number;
  correct: number;
};

export type SessionProgress = {
  answered: number;
  correct: number;
  streak: number;
  turn: number;
};

export type ProgressState = {
  version: number;
  items: Record<string, ItemProgress>;
  skills: Record<SkillKey, SkillProgress>;
  session: SessionProgress;
};
