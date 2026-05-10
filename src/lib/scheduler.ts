import { STAGE_ORDER } from '../types';
import type { ExerciseRecord, ProgressState, SkillKey, StageId } from '../types';
import { getItemProgress, getSkillProgress } from './progress';

const STAGE_UNLOCK_CORRECT_THRESHOLDS = [0, 4, 8, 12, 18, 24, 32, 42, 54, 68, 84];

type PickNextExerciseOptions = {
  stage?: StageId;
  reviewMisses?: boolean;
  skill?: SkillKey;
};

export function getMissedExerciseCount(
  exercises: ExerciseRecord[],
  progress: ProgressState,
) {
  return exercises.filter((exercise) => {
    const item = getItemProgress(progress, exercise.id);
    return item.attempts > 0 && !item.lastCorrect;
  }).length;
}

export function getUnlockedStageIndex(progress: ProgressState) {
  const totalCorrect = progress.session.correct;
  let index = 0;

  STAGE_UNLOCK_CORRECT_THRESHOLDS.forEach((threshold, thresholdIndex) => {
    if (totalCorrect >= threshold) {
      index = thresholdIndex;
    }
  });

  return Math.min(index, STAGE_ORDER.length - 1);
}

export function pickNextExercise(
  exercises: ExerciseRecord[],
  progress: ProgressState,
  options?: PickNextExerciseOptions,
): ExerciseRecord {
  const unlockedStageIndex = getUnlockedStageIndex(progress);
  const currentTurn = progress.session.turn;

  const candidates = exercises.filter((exercise) => {
    const itemProgress = getItemProgress(progress, exercise.id);

    if (options?.reviewMisses) {
      return itemProgress.attempts > 0 && !itemProgress.lastCorrect;
    }

    if (options?.skill) {
      return exercise.skills.includes(options.skill);
    }

    if (options?.stage) {
      return exercise.stage === options.stage;
    }

    const stageIndex = STAGE_ORDER.indexOf(exercise.stage);
    return stageIndex <= unlockedStageIndex || itemProgress.attempts > 0;
  });

  const ranked = candidates
    .map((exercise) => {
      const item = getItemProgress(progress, exercise.id);
      const stageIndex = STAGE_ORDER.indexOf(exercise.stage);
      const due = item.dueTurn <= currentTurn;
      const overdueBy = Math.max(0, currentTurn - item.dueTurn);
      const unseen = item.attempts === 0 ? 1 : 0;
      const focusedSkill = options?.skill;
      const relevantSkills = focusedSkill ? [focusedSkill] : exercise.skills;
      const skillWeakness = relevantSkills.reduce((sum, skill) => {
        const skillProgress = getSkillProgress(progress, skill);
        if (skillProgress.attempts === 0) {
          return sum + 0.8;
        }

        return sum + (1 - skillProgress.correct / skillProgress.attempts);
      }, 0);
      const recentPenalty = item.lastSeenTurn === currentTurn ? 100 : item.lastSeenTurn === currentTurn - 1 ? 8 : 0;
      const stagePressure =
        options?.stage || options?.skill || options?.reviewMisses
          ? 0
          : Math.max(0, unlockedStageIndex - stageIndex);
      const difficultyPenalty = options?.skill ? exercise.difficulty * 3 : 0;

      return {
        exercise,
        due,
        dueTurn: item.dueTurn,
        score:
          (due ? 100 : 0) +
          overdueBy * 5 +
          unseen * 9 +
          skillWeakness * 12 -
          recentPenalty -
          item.streak * 1.5 -
          stagePressure * 0.3 -
          difficultyPenalty -
          exercise.sequence * 0.001,
      };
    })
    .sort((left, right) => {
      if (left.due !== right.due) {
        return left.due ? -1 : 1;
      }

      if (!left.due && left.dueTurn !== right.dueTurn) {
        return left.dueTurn - right.dueTurn;
      }

      return right.score - left.score;
    });

  if (ranked[0]?.exercise) {
    return ranked[0].exercise;
  }

  if (options?.stage) {
    return exercises.find((exercise) => exercise.stage === options.stage) ?? exercises[0];
  }

  if (options?.skill) {
    const focusedSkill = options.skill;
    return exercises.find((exercise) => exercise.skills.includes(focusedSkill)) ?? exercises[0];
  }

  return exercises[0];
}
