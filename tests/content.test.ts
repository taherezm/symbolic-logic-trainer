import { exerciseBank, exerciseCounts } from '../src/data';
import { gradeExercise } from '../src/lib/grading';
import { checkArgumentValidityFromStrings, evaluateFormulaString } from '../src/logic/engine';

describe('seeded content', () => {
  it('meets the minimum exercise counts', () => {
    expect(exerciseCounts.truthValue).toBeGreaterThanOrEqual(50);
    expect(exerciseCounts.translation).toBeGreaterThanOrEqual(50);
    expect(exerciseCounts.validity).toBeGreaterThanOrEqual(30);
    expect(exerciseCounts.proofs).toBeGreaterThanOrEqual(25);
  });

  it('uses unique exercise ids', () => {
    const ids = exerciseBank.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps validity answer keys aligned with the logic engine', () => {
    const validityExercises = exerciseBank.filter(
      (exercise) => exercise.type === 'validity',
    );

    validityExercises.forEach((exercise) => {
      const verdict = checkArgumentValidityFromStrings(
        exercise.premises,
        exercise.conclusion,
      );
      expect(verdict.valid).toBe(!exercise.fallacyName);
    });
  });

  it('accepts direct beginner-friendly equivalent translations where appropriate', () => {
    const exercise = exerciseBank.find((item) => item.id === 'et-010');
    expect(exercise?.type).toBe('english-to-symbolic');

    if (!exercise || exercise.type !== 'english-to-symbolic') {
      throw new Error('Expected english-to-symbolic exercise et-010');
    }

    const outcome = gradeExercise(exercise, '¬P ∧ ¬Q');
    expect(outcome.correct).toBe(true);
  });

  it('grades every truth-value drill consistently', () => {
    const drills = exerciseBank.filter((exercise) => exercise.type === 'truth-value');

    drills.forEach((exercise) => {
      const expected = evaluateFormulaString(exercise.formula, exercise.assignment);
      expect(gradeExercise(exercise, 'true').correct).toBe(expected);
      expect(gradeExercise(exercise, 'false').correct).toBe(!expected);
    });
  });

  it('accepts every seeded symbolic translation answer and rejects seeded common mistakes', () => {
    const translationExercises = exerciseBank.filter(
      (exercise) => exercise.type === 'english-to-symbolic',
    );

    translationExercises.forEach((exercise) => {
      exercise.acceptedFormulas.forEach((formula) => {
        expect(gradeExercise(exercise, formula).correct).toBe(true);
      });

      exercise.commonMistakes.forEach((mistake) => {
        expect(gradeExercise(exercise, mistake.formula).correct).toBe(false);
      });
    });
  });

  it('keeps every multiple-choice answer key internally consistent', () => {
    const mcExercises = exerciseBank.filter(
      (exercise) =>
        exercise.type === 'symbolic-to-english' || exercise.type === 'proof-step',
    );

    mcExercises.forEach((exercise) => {
      exercise.options.forEach((option) => {
        const outcome = gradeExercise(exercise, option.id);
        expect(outcome.correct).toBe(option.id === exercise.correctOptionId);
      });
    });
  });

  it('rejects the opposite verdict for every validity exercise', () => {
    const validityExercises = exerciseBank.filter(
      (exercise) => exercise.type === 'validity',
    );

    validityExercises.forEach((exercise) => {
      const verdict = checkArgumentValidityFromStrings(
        exercise.premises,
        exercise.conclusion,
      );
      expect(gradeExercise(exercise, verdict.valid ? 'invalid' : 'valid').correct).toBe(false);
      expect(gradeExercise(exercise, verdict.valid ? 'valid' : 'invalid').correct).toBe(true);
    });
  });
});
