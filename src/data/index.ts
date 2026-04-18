import { parseOrThrow } from '../logic/parser';
import type { ExerciseRecord } from '../types';
import { proofStepExercises } from './proofSteps';
import { englishToSymbolicExercises, symbolicToEnglishExercises } from './translations';
import { truthValueExercises } from './truthDrills';
import { validityExercises } from './validity';

const rawExercises = [
  ...truthValueExercises,
  ...englishToSymbolicExercises,
  ...symbolicToEnglishExercises,
  ...validityExercises,
  ...proofStepExercises,
];

function validateExercises() {
  rawExercises.forEach((exercise) => {
    switch (exercise.type) {
      case 'truth-value':
        parseOrThrow(exercise.formula);
        break;
      case 'english-to-symbolic':
        exercise.acceptedFormulas.forEach(parseOrThrow);
        exercise.commonMistakes.forEach((mistake) => parseOrThrow(mistake.formula));
        break;
      case 'symbolic-to-english':
        parseOrThrow(exercise.formula);
        break;
      case 'validity':
        exercise.premises.forEach(parseOrThrow);
        parseOrThrow(exercise.conclusion);
        break;
      case 'proof-step':
        exercise.premises.forEach(parseOrThrow);
        exercise.derived?.forEach(parseOrThrow);
        parseOrThrow(exercise.goal);
        break;
    }
  });
}

validateExercises();

export const exerciseBank: ExerciseRecord[] = rawExercises.map((exercise, sequence) => ({
  ...exercise,
  sequence,
}));

export const exerciseCounts = {
  truthValue: truthValueExercises.length,
  translation: englishToSymbolicExercises.length + symbolicToEnglishExercises.length,
  validity: validityExercises.length,
  proofs: proofStepExercises.length,
};
