import type { ExerciseRecord } from '../src/types';
import { applyOutcome, createEmptyProgress } from '../src/lib/progress';
import { pickNextExercise } from '../src/lib/scheduler';

const exercises: ExerciseRecord[] = [
  {
    id: 'mini-a',
    type: 'truth-value',
    stage: 'sentence-letters',
    title: 'Truth-Value Micro-Drill',
    prompt: 'Given the assignment, what is the truth value of the formula?',
    formula: 'P',
    assignment: { P: true },
    skills: ['sentence-letters'],
    difficulty: 1,
    sequence: 0,
  },
  {
    id: 'mini-b',
    type: 'truth-value',
    stage: 'sentence-letters',
    title: 'Truth-Value Micro-Drill',
    prompt: 'Given the assignment, what is the truth value of the formula?',
    formula: 'Q',
    assignment: { Q: true },
    skills: ['sentence-letters'],
    difficulty: 1,
    sequence: 1,
  },
];

describe('scheduler', () => {
  it('brings missed work back sooner than clean work', () => {
    let progress = createEmptyProgress();

    progress = applyOutcome(progress, exercises[0], true);
    progress = applyOutcome(progress, exercises[1], false);

    expect(pickNextExercise(exercises, progress).id).toBe('mini-b');
  });
});
