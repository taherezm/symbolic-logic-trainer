import { STAGE_ORDER } from '../types';
import type { ExerciseRecord, ProgressState } from '../types';
import { getItemProgress, getSkillProgress } from './progress';

const STAGE_UNLOCK_CORRECT_THRESHOLDS = [0, 4, 8, 12, 18, 24, 32, 42, 54, 68, 84];

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
): ExerciseRecord {
  const unlockedStageIndex = getUnlockedStageIndex(progress);
  const currentTurn = progress.session.turn;

  const candidates = exercises.filter((exercise) => {
    const stageIndex = STAGE_ORDER.indexOf(exercise.stage);
    const itemProgress = getItemProgress(progress, exercise.id);
    return stageIndex <= unlockedStageIndex || itemProgress.attempts > 0;
  });

  const ranked = candidates
    .map((exercise) => {
      const item = getItemProgress(progress, exercise.id);
      const stageIndex = STAGE_ORDER.indexOf(exercise.stage);
      const due = item.dueTurn <= currentTurn;
      const overdueBy = Math.max(0, currentTurn - item.dueTurn);
      const unseen = item.attempts === 0 ? 1 : 0;
      const skillWeakness = exercise.skills.reduce((sum, skill) => {
        const skillProgress = getSkillProgress(progress, skill);
        if (skillProgress.attempts === 0) {
          return sum + 0.8;
        }

        return sum + (1 - skillProgress.correct / skillProgress.attempts);
      }, 0);
      const recentPenalty = item.lastSeenTurn === currentTurn ? 100 : item.lastSeenTurn === currentTurn - 1 ? 8 : 0;
      const stagePressure = Math.max(0, unlockedStageIndex - stageIndex);

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

  return ranked[0]?.exercise ?? exercises[0];
}
