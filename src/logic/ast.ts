export type BinaryOperator = 'and' | 'or' | 'implies' | 'iff';

export type VariableNode = {
  kind: 'variable';
  name: string;
};

export type NotNode = {
  kind: 'not';
  operand: FormulaNode;
};

export type BinaryNode = {
  kind: 'binary';
  operator: BinaryOperator;
  left: FormulaNode;
  right: FormulaNode;
};

export type FormulaNode = VariableNode | NotNode | BinaryNode;

export type TruthAssignment = Record<string, boolean>;

export type ParseSuccess = {
  ok: true;
  ast: FormulaNode;
};

export type ParseFailure = {
  ok: false;
  message: string;
  position: number;
};

export type ParseResult = ParseSuccess | ParseFailure;

export type EvaluationTrace =
  | {
      kind: 'variable';
      value: boolean;
      node: VariableNode;
    }
  | {
      kind: 'not';
      value: boolean;
      node: NotNode;
      operand: EvaluationTrace;
    }
  | {
      kind: 'binary';
      value: boolean;
      node: BinaryNode;
      left: EvaluationTrace;
      right: EvaluationTrace;
    };

export const OPERATOR_SYMBOLS: Record<BinaryOperator, string> = {
  and: '∧',
  or: '∨',
  implies: '→',
  iff: '↔',
};
