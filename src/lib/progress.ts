import type {
  ExerciseRecord,
  ItemProgress,
  ProgressState,
  SkillKey,
  SkillProgress,
} from '../types';

const STORAGE_KEY = 'symbolic-logic-trainer-progress-v1';
const PROGRESS_VERSION = 1;

export function createEmptyProgress(): ProgressState {
  return {
    version: PROGRESS_VERSION,
    items: {},
    skills: {
      'sentence-letters': { attempts: 0, correct: 0 },
      negation: { attempts: 0, correct: 0 },
      conjunction: { attempts: 0, correct: 0 },
      disjunction: { attempts: 0, correct: 0 },
      conditionals: { attempts: 0, correct: 0 },
      biconditionals: { attempts: 0, correct: 0 },
      translation: { attempts: 0, correct: 0 },
      validity: { attempts: 0, correct: 0 },
      proofs: { attempts: 0, correct: 0 },
    },
    session: {
      answered: 0,
      correct: 0,
      streak: 0,
      turn: 0,
    },
  };
}

export function loadProgress(): ProgressState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyProgress();
    }

    const parsed = JSON.parse(raw) as ProgressState;
    if (parsed.version !== PROGRESS_VERSION) {
      return createEmptyProgress();
    }

    return {
      ...createEmptyProgress(),
      ...parsed,
      skills: {
        ...createEmptyProgress().skills,
        ...parsed.skills,
      },
    };
  } catch {
    return createEmptyProgress();
  }
}

export function saveProgress(progress: ProgressState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    return;
  }
}

export function resetProgress() {
  const empty = createEmptyProgress();
  saveProgress(empty);
  return empty;
}

export function getItemProgress(progress: ProgressState, exerciseId: string): ItemProgress {
  return (
    progress.items[exerciseId] ?? {
      attempts: 0,
      correct: 0,
      streak: 0,
      dueTurn: 0,
      lastSeenTurn: -9999,
      lastCorrect: false,
    }
  );
}

export function getSkillProgress(progress: ProgressState, skill: SkillKey): SkillProgress {
  return progress.skills[skill] ?? { attempts: 0, correct: 0 };
}

function intervalForCorrectStreak(streak: number) {
  if (streak <= 1) {
    return 3;
  }

  if (streak === 2) {
    return 6;
  }

  if (streak === 3) {
    return 10;
  }

  if (streak === 4) {
    return 16;
  }

  return 24;
}

export function applyOutcome(
  progress: ProgressState,
  exercise: ExerciseRecord,
  correct: boolean,
): ProgressState {
  const current = getItemProgress(progress, exercise.id);
  const turn = progress.session.turn + 1;
  const streak = correct ? current.streak + 1 : 0;
  const dueTurn = correct ? turn + intervalForCorrectStreak(streak) : turn + 1;

  const nextProgress: ProgressState = {
    version: PROGRESS_VERSION,
    items: {
      ...progress.items,
      [exercise.id]: {
        attempts: current.attempts + 1,
        correct: current.correct + (correct ? 1 : 0),
        streak,
        dueTurn,
        lastSeenTurn: turn,
        lastCorrect: correct,
      },
    },
    skills: { ...progress.skills },
    session: {
      answered: progress.session.answered + 1,
      correct: progress.session.correct + (correct ? 1 : 0),
      streak: correct ? progress.session.streak + 1 : 0,
      turn,
    },
  };

  exercise.skills.forEach((skill) => {
    const currentSkill = getSkillProgress(progress, skill);
    nextProgress.skills[skill] = {
      attempts: currentSkill.attempts + 1,
      correct: currentSkill.correct + (correct ? 1 : 0),
    };
  });

  return nextProgress;
}

export function accuracyForSkill(progress: ProgressState, skill: SkillKey) {
  const current = getSkillProgress(progress, skill);
  if (current.attempts === 0) {
    return null;
  }

  return current.correct / current.attempts;
}
