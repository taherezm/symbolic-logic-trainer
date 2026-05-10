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
  {
    id: 'mini-c',
    type: 'truth-value',
    stage: 'validity-basics',
    title: 'Truth-Value Micro-Drill',
    prompt: 'Given the assignment, what is the truth value of the formula?',
    formula: 'R',
    assignment: { R: true },
    skills: ['sentence-letters'],
    difficulty: 1,
    sequence: 2,
  },
  {
    id: 'mini-d',
    type: 'truth-value',
    stage: 'conditionals',
    title: 'Truth-Value Micro-Drill',
    prompt: 'Given the assignment, what is the truth value of the formula?',
    formula: 'P → Q',
    assignment: { P: true, Q: false },
    skills: ['conditionals'],
    difficulty: 1,
    sequence: 3,
  },
];

describe('scheduler', () => {
  it('brings missed work back sooner than clean work', () => {
    let progress = createEmptyProgress();

    progress = applyOutcome(progress, exercises[0], true);
    progress = applyOutcome(progress, exercises[1], false);

    expect(pickNextExercise(exercises, progress).id).toBe('mini-b');
  });

  it('can jump directly to a chosen stage', () => {
    const progress = createEmptyProgress();

    expect(pickNextExercise(exercises, progress, { stage: 'validity-basics' }).id).toBe('mini-c');
  });

  it('can review only missed work', () => {
    let progress = createEmptyProgress();

    progress = applyOutcome(progress, exercises[0], true);
    progress = applyOutcome(progress, exercises[1], false);

    expect(pickNextExercise(exercises, progress, { reviewMisses: true }).id).toBe('mini-b');
  });

  it('can focus a single skill across stages', () => {
    const progress = createEmptyProgress();

    expect(pickNextExercise(exercises, progress, { skill: 'conditionals' }).id).toBe('mini-d');
  });
});
