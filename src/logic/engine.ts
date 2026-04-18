import type {
  BinaryNode,
  BinaryOperator,
  EvaluationTrace,
  FormulaNode,
  TruthAssignment,
} from './ast';
import { OPERATOR_SYMBOLS } from './ast';
import { parseFormula, parseOrThrow } from './parser';

function childNeedsParentheses(parent: BinaryNode, child: FormulaNode, side: 'left' | 'right') {
  if (child.kind !== 'binary') {
    return false;
  }

  if (parent.operator === child.operator && (parent.operator === 'and' || parent.operator === 'or')) {
    return false;
  }

  if (parent.operator === 'implies' && side === 'right' && child.operator === 'implies') {
    return true;
  }

  return true;
}

export function formatFormula(node: FormulaNode): string {
  if (node.kind === 'variable') {
    return node.name;
  }

  if (node.kind === 'not') {
    const renderedOperand =
      node.operand.kind === 'variable' || node.operand.kind === 'not'
        ? formatFormula(node.operand)
        : `(${formatFormula(node.operand)})`;
    return `¬${renderedOperand}`;
  }

  const left = childNeedsParentheses(node, node.left, 'left')
    ? `(${formatFormula(node.left)})`
    : formatFormula(node.left);
  const right = childNeedsParentheses(node, node.right, 'right')
    ? `(${formatFormula(node.right)})`
    : formatFormula(node.right);

  return `${left} ${OPERATOR_SYMBOLS[node.operator]} ${right}`;
}

export function evaluateFormula(node: FormulaNode, assignment: TruthAssignment): boolean {
  if (node.kind === 'variable') {
    if (!(node.name in assignment)) {
      throw new Error(`Missing truth value for ${node.name}`);
    }

    return assignment[node.name];
  }

  if (node.kind === 'not') {
    return !evaluateFormula(node.operand, assignment);
  }

  const left = evaluateFormula(node.left, assignment);
  const right = evaluateFormula(node.right, assignment);

  switch (node.operator) {
    case 'and':
      return left && right;
    case 'or':
      return left || right;
    case 'implies':
      return !left || right;
    case 'iff':
      return left === right;
  }
}

export function evaluateFormulaString(formula: string, assignment: TruthAssignment) {
  return evaluateFormula(parseOrThrow(formula), assignment);
}

export function evaluateWithTrace(
  node: FormulaNode,
  assignment: TruthAssignment,
): EvaluationTrace {
  if (node.kind === 'variable') {
    return {
      kind: 'variable',
      node,
      value: evaluateFormula(node, assignment),
    };
  }

  if (node.kind === 'not') {
    const operand = evaluateWithTrace(node.operand, assignment);
    return {
      kind: 'not',
      node,
      operand,
      value: !operand.value,
    };
  }

  const left = evaluateWithTrace(node.left, assignment);
  const right = evaluateWithTrace(node.right, assignment);

  return {
    kind: 'binary',
    node,
    left,
    right,
    value: evaluateFormula(node, assignment),
  };
}

export function collectVariables(node: FormulaNode): string[] {
  const variables = new Set<string>();

  const visit = (current: FormulaNode) => {
    if (current.kind === 'variable') {
      variables.add(current.name);
      return;
    }

    if (current.kind === 'not') {
      visit(current.operand);
      return;
    }

    visit(current.left);
    visit(current.right);
  };

  visit(node);

  return [...variables].sort();
}

export function generateAssignments(variables: string[]): TruthAssignment[] {
  const assignments: TruthAssignment[] = [];
  const totalRows = 2 ** variables.length;

  for (let row = 0; row < totalRows; row += 1) {
    const assignment: TruthAssignment = {};

    variables.forEach((variable, index) => {
      const bit = (row >> (variables.length - index - 1)) & 1;
      assignment[variable] = bit === 1;
    });

    assignments.push(assignment);
  }

  return assignments;
}

export function isEquivalent(left: FormulaNode, right: FormulaNode): boolean {
  const variables = [...new Set([...collectVariables(left), ...collectVariables(right)])].sort();
  const assignments = generateAssignments(variables);

  return assignments.every((assignment) => {
    return evaluateFormula(left, assignment) === evaluateFormula(right, assignment);
  });
}

export function isEquivalentFormulaString(left: string, right: string) {
  const leftParsed = parseFormula(left);
  const rightParsed = parseFormula(right);

  if (!leftParsed.ok || !rightParsed.ok) {
    return false;
  }

  return isEquivalent(leftParsed.ast, rightParsed.ast);
}

function flattenAssociative(node: FormulaNode, operator: BinaryOperator): FormulaNode[] {
  if (node.kind !== 'binary' || node.operator !== operator) {
    return [node];
  }

  return [
    ...flattenAssociative(node.left, operator),
    ...flattenAssociative(node.right, operator),
  ];
}

export function canonicalizeForTranslation(node: FormulaNode): string {
  if (node.kind === 'variable') {
    return node.name;
  }

  if (node.kind === 'not') {
    const inner = canonicalizeForTranslation(node.operand);
    return node.operand.kind === 'variable' || node.operand.kind === 'not'
      ? `¬${inner}`
      : `¬(${inner})`;
  }

  if (node.operator === 'and' || node.operator === 'or') {
    const parts = flattenAssociative(node, node.operator)
      .map(canonicalizeForTranslation)
      .sort();
    return `(${parts.join(OPERATOR_SYMBOLS[node.operator])})`;
  }

  if (node.operator === 'iff') {
    const parts = [
      canonicalizeForTranslation(node.left),
      canonicalizeForTranslation(node.right),
    ].sort();
    return `(${parts[0]}↔${parts[1]})`;
  }

  return `(${canonicalizeForTranslation(node.left)}→${canonicalizeForTranslation(node.right)})`;
}

export function isTranslationEquivalent(left: FormulaNode, right: FormulaNode) {
  return canonicalizeForTranslation(left) === canonicalizeForTranslation(right);
}

export function usesOnlyVariables(node: FormulaNode, allowedVariables: string[]) {
  const allowed = new Set(allowedVariables.map((variable) => variable.toUpperCase()));
  return collectVariables(node).every((variable) => allowed.has(variable));
}

export function checkArgumentValidity(premises: FormulaNode[], conclusion: FormulaNode) {
  const variables = [
    ...new Set(
      premises.flatMap((premise) => collectVariables(premise)).concat(collectVariables(conclusion)),
    ),
  ].sort();

  const assignments = generateAssignments(variables);
  for (const assignment of assignments) {
    const premisesTrue = premises.every((premise) => evaluateFormula(premise, assignment));
    if (!premisesTrue) {
      continue;
    }

    const conclusionTrue = evaluateFormula(conclusion, assignment);
    if (!conclusionTrue) {
      return {
        valid: false as const,
        counterexample: assignment,
      };
    }
  }

  return {
    valid: true as const,
  };
}

export function checkArgumentValidityFromStrings(premises: string[], conclusion: string) {
  return checkArgumentValidity(
    premises.map((premise) => parseOrThrow(premise)),
    parseOrThrow(conclusion),
  );
}

export function describeAssignment(assignment: TruthAssignment) {
  return Object.entries(assignment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([variable, value]) => `${variable} = ${value ? 'T' : 'F'}`)
    .join(', ');
}
