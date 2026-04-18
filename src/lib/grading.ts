import {
  canonicalizeForTranslation,
  checkArgumentValidityFromStrings,
  describeAssignment,
  evaluateFormulaString,
  evaluateWithTrace,
  formatFormula,
  isEquivalent,
  isTranslationEquivalent,
  usesOnlyVariables,
} from '../logic/engine';
import type { EvaluationTrace } from '../logic/ast';
import { parseFormula, parseOrThrow } from '../logic/parser';
import type {
  EnglishToSymbolicExercise,
  Exercise,
  ExerciseOutcome,
  SymbolicToEnglishExercise,
  TruthValueExercise,
  ValidityExercise,
} from '../types';

function truthLabel(value: boolean) {
  return value ? 'True' : 'False';
}

function truthLabelLower(value: boolean) {
  return truthLabel(value).toLowerCase();
}

export type TruthValueReviewRow = {
  key: string;
  role: 'given' | 'step' | 'result';
  expression: string;
  value: boolean;
  reason: string;
};

export type ValidityReview = {
  assignmentSummary: string;
  rows: Array<{
    role: 'Premise' | 'Conclusion';
    expression: string;
    value: boolean;
  }>;
};

function buildBinaryReason(
  operator: 'and' | 'or' | 'implies' | 'iff',
  leftExpression: string,
  leftValue: boolean,
  rightExpression: string,
  rightValue: boolean,
  wholeExpression: string,
  wholeValue: boolean,
) {
  switch (operator) {
    case 'and':
      return `${leftExpression} is ${truthLabelLower(leftValue)} and ${rightExpression} is ${truthLabelLower(rightValue)}. A conjunction is true only when both parts are true, so ${wholeExpression} is ${truthLabelLower(wholeValue)}.`;
    case 'or':
      return `${leftExpression} is ${truthLabelLower(leftValue)} and ${rightExpression} is ${truthLabelLower(rightValue)}. An inclusive OR is false only when both parts are false, so ${wholeExpression} is ${truthLabelLower(wholeValue)}.`;
    case 'implies':
      return `${leftExpression} is ${truthLabelLower(leftValue)} and ${rightExpression} is ${truthLabelLower(rightValue)}. A conditional is false only in the one case where the antecedent is true and the consequent is false, so ${wholeExpression} is ${truthLabelLower(wholeValue)}.`;
    case 'iff':
      return `${leftExpression} is ${truthLabelLower(leftValue)} and ${rightExpression} is ${truthLabelLower(rightValue)}. A biconditional is true only when both sides match, so ${wholeExpression} is ${truthLabelLower(wholeValue)}.`;
  }
}

export function buildTruthValueReview(exercise: TruthValueExercise): TruthValueReviewRow[] {
  const trace = evaluateWithTrace(parseOrThrow(exercise.formula), exercise.assignment);

  if (trace.kind === 'variable') {
    return [
      {
        key: `given-${trace.node.name}`,
        role: 'given',
        expression: trace.node.name,
        value: trace.value,
        reason: `The truth-value table assigns ${trace.node.name} the value ${truthLabel(trace.value)}.`,
      },
      {
        key: `result-${formatFormula(trace.node)}`,
        role: 'result',
        expression: formatFormula(trace.node),
        value: trace.value,
        reason: `The whole formula is just ${trace.node.name}, so it has that same truth value.`,
      },
    ];
  }

  const rows: TruthValueReviewRow[] = [];
  const seenGivens = new Set<string>();

  const visit = (current: EvaluationTrace) => {
    if (current.kind === 'variable') {
      if (!seenGivens.has(current.node.name)) {
        rows.push({
          key: `given-${current.node.name}`,
          role: 'given',
          expression: current.node.name,
          value: current.value,
          reason: `The truth-value table assigns ${current.node.name} the value ${truthLabel(current.value)}.`,
        });
        seenGivens.add(current.node.name);
      }
      return;
    }

    if (current.kind === 'not') {
      visit(current.operand);
      rows.push({
        key: `step-${formatFormula(current.node)}`,
        role: 'step',
        expression: formatFormula(current.node),
        value: current.value,
        reason: `${formatFormula(current.operand.node)} is ${truthLabelLower(current.operand.value)}, so negating it makes ${formatFormula(current.node)} ${truthLabelLower(current.value)}.`,
      });
      return;
    }

    visit(current.left);
    visit(current.right);
    rows.push({
      key: `step-${formatFormula(current.node)}`,
      role: 'step',
      expression: formatFormula(current.node),
      value: current.value,
      reason: buildBinaryReason(
        current.node.operator,
        formatFormula(current.left.node),
        current.left.value,
        formatFormula(current.right.node),
        current.right.value,
        formatFormula(current.node),
        current.value,
      ),
    });
  };

  visit(trace);

  return rows.map((row, index) => ({
    ...row,
    role: index === rows.length - 1 ? 'result' : row.role,
  }));
}

function explainTrace(exercise: TruthValueExercise) {
  const rows = buildTruthValueReview(exercise);
  return rows[rows.length - 1]?.reason ?? 'Check the truth-value table.';
}

function gradeTruthValue(exercise: TruthValueExercise, answer: string): ExerciseOutcome {
  const parsedAnswer = answer.trim().toLowerCase();
  const normalized =
    parsedAnswer === 't' || parsedAnswer === 'true'
      ? true
      : parsedAnswer === 'f' || parsedAnswer === 'false'
        ? false
        : null;
  const trace = evaluateWithTrace(parseOrThrow(exercise.formula), exercise.assignment);

  if (normalized === null) {
    return {
      correct: false,
      feedback: 'Use True or False for this drill.',
      expected: truthLabel(trace.value),
    };
  }

  return {
    correct: normalized === trace.value,
    feedback: explainTrace(exercise),
    expected: truthLabel(trace.value),
  };
}

function legendSymbols(exercise: EnglishToSymbolicExercise) {
  return exercise.legend.map((entry) => entry.symbol);
}

function directTranslationMessage(formula: string) {
  const ast = parseOrThrow(formula);
  if (ast.kind === 'variable') {
    return 'Use the matching sentence letter directly.';
  }

  if (ast.kind === 'not') {
    return 'Check where the negation belongs.';
  }

  switch (ast.operator) {
    case 'and':
      return 'Check the main connective. This sentence joins both parts with AND.';
    case 'or':
      return 'Check the main connective. This sentence needs inclusive OR.';
    case 'implies':
      return 'Check the arrow direction. Ask which part is the condition and which part depends on it.';
    case 'iff':
      return 'This sentence needs both directions, not a one-way arrow.';
  }
}

function gradeEnglishToSymbolic(
  exercise: EnglishToSymbolicExercise,
  answer: string,
): ExerciseOutcome {
  const parsed = parseFormula(answer);
  const expected = exercise.acceptedFormulas[0];

  if (!parsed.ok) {
    return {
      correct: false,
      feedback: parsed.message,
      expected,
    };
  }

  if (!usesOnlyVariables(parsed.ast, legendSymbols(exercise))) {
    return {
      correct: false,
      feedback: 'Use only the sentence letters from the legend for this translation.',
      expected,
      parsedAnswer: formatFormula(parsed.ast),
    };
  }

  const acceptedAst = exercise.acceptedFormulas.map((formula) => parseOrThrow(formula));
  const commonMistakes = exercise.commonMistakes.map((mistake) => ({
    ...mistake,
    ast: parseOrThrow(mistake.formula),
  }));

  if (acceptedAst.some((accepted) => isTranslationEquivalent(parsed.ast, accepted))) {
    return {
      correct: true,
      feedback: `Correct. ${formatFormula(parsed.ast)} matches the sentence structure.`,
      expected,
      parsedAnswer: formatFormula(parsed.ast),
    };
  }

  const matchedMistake = commonMistakes.find((mistake) =>
    isTranslationEquivalent(parsed.ast, mistake.ast),
  );

  if (matchedMistake) {
    return {
      correct: false,
      feedback: matchedMistake.feedback,
      expected,
      parsedAnswer: formatFormula(parsed.ast),
    };
  }

  if (acceptedAst.some((accepted) => isEquivalent(parsed.ast, accepted))) {
    return {
      correct: false,
      feedback:
        'That may be logically equivalent, but it does not mirror the sentence structure being trained here.',
      expected,
      parsedAnswer: canonicalizeForTranslation(parsed.ast),
    };
  }

  return {
    correct: false,
    feedback: directTranslationMessage(expected),
    expected,
    parsedAnswer: formatFormula(parsed.ast),
  };
}

function gradeSymbolicToEnglish(
  exercise: SymbolicToEnglishExercise,
  answer: string,
): ExerciseOutcome {
  const selected = exercise.options.find((option) => option.id === answer);
  const correctOption = exercise.options.find(
    (option) => option.id === exercise.correctOptionId,
  )!;

  if (!selected) {
    return {
      correct: false,
      feedback: 'Pick one of the answer choices.',
      expected: correctOption.label,
    };
  }

  return {
    correct: selected.id === exercise.correctOptionId,
    feedback: selected.feedback,
    expected: correctOption.label,
  };
}

function validityFeedback(exercise: ValidityExercise, isValid: boolean) {
  const verdict = checkArgumentValidityFromStrings(exercise.premises, exercise.conclusion);

  if (verdict.valid) {
    return `Valid means there is no counterexample row: no possible case makes every premise true and the conclusion false. This argument is valid${exercise.argumentLabel ? ` and matches ${exercise.argumentLabel}.` : '.'}`;
  }

  const counterexample = describeAssignment(verdict.counterexample);
  const fallacyNote = exercise.fallacyName ? ` ${exercise.fallacyName}.` : '';

  if (isValid) {
    return `The argument is invalid because there is a counterexample row. With ${counterexample}, all premises are true while the conclusion is false.${fallacyNote}`;
  }

  return `Correct. An invalid argument has at least one counterexample row. Here, with ${counterexample}, the premises are all true while the conclusion is false.${fallacyNote}`;
}

function gradeValidity(exercise: ValidityExercise, answer: string): ExerciseOutcome {
  const normalized = answer.trim().toLowerCase();
  const userThinksValid =
    normalized === 'valid' || normalized === 'v'
      ? true
      : normalized === 'invalid' || normalized === 'i'
        ? false
        : null;

  const verdict = checkArgumentValidityFromStrings(exercise.premises, exercise.conclusion);

  if (userThinksValid === null) {
    return {
      correct: false,
      feedback: 'Answer with Valid or Invalid.',
      expected: verdict.valid ? 'Valid' : 'Invalid',
    };
  }

  return {
    correct: userThinksValid === verdict.valid,
    feedback: validityFeedback(exercise, userThinksValid),
    expected: verdict.valid ? 'Valid' : 'Invalid',
  };
}

export function buildValidityReview(exercise: ValidityExercise): ValidityReview | null {
  const verdict = checkArgumentValidityFromStrings(exercise.premises, exercise.conclusion);

  if (verdict.valid) {
    return null;
  }

  return {
    assignmentSummary: describeAssignment(verdict.counterexample),
    rows: [
      ...exercise.premises.map((premise) => ({
        role: 'Premise' as const,
        expression: premise,
        value: evaluateFormulaString(premise, verdict.counterexample),
      })),
      {
        role: 'Conclusion' as const,
        expression: exercise.conclusion,
        value: evaluateFormulaString(exercise.conclusion, verdict.counterexample),
      },
    ],
  };
}

export function gradeExercise(exercise: Exercise, answer: string): ExerciseOutcome {
  switch (exercise.type) {
    case 'truth-value':
      return gradeTruthValue(exercise, answer);
    case 'english-to-symbolic':
      return gradeEnglishToSymbolic(exercise, answer);
    case 'symbolic-to-english':
      return gradeSymbolicToEnglish(exercise, answer);
    case 'validity':
      return gradeValidity(exercise, answer);
    case 'proof-step': {
      const selected = exercise.options.find((option) => option.id === answer);
      const correctOption = exercise.options.find(
        (option) => option.id === exercise.correctOptionId,
      )!;

      if (!selected) {
        return {
          correct: false,
          feedback: 'Pick one of the answer choices.',
          expected: correctOption.label,
        };
      }

      return {
        correct: selected.id === exercise.correctOptionId,
        feedback: selected.feedback,
        expected: correctOption.label,
      };
    }
  }
}
