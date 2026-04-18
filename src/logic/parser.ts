import type { FormulaNode, ParseResult } from './ast';

type Token =
  | { type: 'lparen'; index: number }
  | { type: 'rparen'; index: number }
  | { type: 'operator'; value: 'not' | 'and' | 'or' | 'implies' | 'iff'; index: number }
  | { type: 'variable'; value: string; index: number };

type OperatorTokenValue = Extract<Token, { type: 'operator' }>['value'];

const WORD_OPERATORS: Array<[string, OperatorTokenValue]> = [
  ['not', 'not'],
  ['and', 'and'],
  ['or', 'or'],
  ['iff', 'iff'],
];

function isBoundaryCharacter(char: string | undefined) {
  return !char || !/[A-Za-z0-9_]/.test(char);
}

function startsWithWord(input: string, index: number, word: string) {
  const segment = input.slice(index, index + word.length);
  if (segment.toLowerCase() !== word) {
    return false;
  }

  return (
    isBoundaryCharacter(input[index - 1]) &&
    isBoundaryCharacter(input[index + word.length])
  );
}

function tokenize(input: string): Token[] | ParseResult {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen', index });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'rparen', index });
      index += 1;
      continue;
    }

    const triChar = input.slice(index, index + 3);
    const biChar = input.slice(index, index + 2);

    if (triChar === '<->' || triChar === '<=>') {
      tokens.push({ type: 'operator', value: 'iff', index });
      index += 3;
      continue;
    }

    if (biChar === '->' || biChar === '=>') {
      tokens.push({ type: 'operator', value: 'implies', index });
      index += 2;
      continue;
    }

    if (char === '↔') {
      tokens.push({ type: 'operator', value: 'iff', index });
      index += 1;
      continue;
    }

    if (char === '→') {
      tokens.push({ type: 'operator', value: 'implies', index });
      index += 1;
      continue;
    }

    if (char === '¬' || char === '~' || char === '!') {
      tokens.push({ type: 'operator', value: 'not', index });
      index += 1;
      continue;
    }

    if (char === '∧' || char === '&' || char === '^') {
      tokens.push({ type: 'operator', value: 'and', index });
      index += 1;
      continue;
    }

    if (char === '∨' || char === '|') {
      tokens.push({ type: 'operator', value: 'or', index });
      index += 1;
      continue;
    }

    if (
      char === 'v' &&
      isBoundaryCharacter(input[index - 1]) &&
      isBoundaryCharacter(input[index + 1])
    ) {
      tokens.push({ type: 'operator', value: 'or', index });
      index += 1;
      continue;
    }

    const matchedWordOperator = WORD_OPERATORS.find(([word]) =>
      startsWithWord(input, index, word),
    );

    if (matchedWordOperator) {
      tokens.push({
        type: 'operator',
        value: matchedWordOperator[1],
        index,
      });
      index += matchedWordOperator[0].length;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let end = index + 1;
      while (end < input.length && /[A-Za-z0-9_]/.test(input[end])) {
        end += 1;
      }

      tokens.push({
        type: 'variable',
        value: input.slice(index, end).toUpperCase(),
        index,
      });
      index = end;
      continue;
    }

    return {
      ok: false,
      message: `Unexpected character "${char}"`,
      position: index,
    };
  }

  return tokens;
}

class Parser {
  constructor(private readonly tokens: Token[]) {}

  private pointer = 0;

  parse(): ParseResult {
    if (this.tokens.length === 0) {
      return {
        ok: false,
        message: 'Enter a formula using the provided sentence letters.',
        position: 0,
      };
    }

    const ast = this.parseIff();
    if (!ast.ok) {
      return ast;
    }

    const nextToken = this.peek();
    if (nextToken) {
      return {
        ok: false,
        message: 'Unexpected extra material at the end of the formula.',
        position: nextToken.index,
      };
    }

    return ast;
  }

  private parseIff(): ParseResult {
    let left = this.parseImplies();
    if (!left.ok) {
      return left;
    }

    while (this.matchOperator('iff')) {
      const right = this.parseImplies();
      if (!right.ok) {
        return right;
      }

      left = {
        ok: true,
        ast: {
          kind: 'binary',
          operator: 'iff',
          left: left.ast,
          right: right.ast,
        },
      };
    }

    return left;
  }

  private parseImplies(): ParseResult {
    const left = this.parseOr();
    if (!left.ok) {
      return left;
    }

    if (this.matchOperator('implies')) {
      const right = this.parseImplies();
      if (!right.ok) {
        return right;
      }

      return {
        ok: true,
        ast: {
          kind: 'binary',
          operator: 'implies',
          left: left.ast,
          right: right.ast,
        },
      };
    }

    return left;
  }

  private parseOr(): ParseResult {
    let left = this.parseAnd();
    if (!left.ok) {
      return left;
    }

    while (this.matchOperator('or')) {
      const right = this.parseAnd();
      if (!right.ok) {
        return right;
      }

      left = {
        ok: true,
        ast: {
          kind: 'binary',
          operator: 'or',
          left: left.ast,
          right: right.ast,
        },
      };
    }

    return left;
  }

  private parseAnd(): ParseResult {
    let left = this.parseNot();
    if (!left.ok) {
      return left;
    }

    while (this.matchOperator('and')) {
      const right = this.parseNot();
      if (!right.ok) {
        return right;
      }

      left = {
        ok: true,
        ast: {
          kind: 'binary',
          operator: 'and',
          left: left.ast,
          right: right.ast,
        },
      };
    }

    return left;
  }

  private parseNot(): ParseResult {
    if (this.matchOperator('not')) {
      const operand = this.parseNot();
      if (!operand.ok) {
        return operand;
      }

      return {
        ok: true,
        ast: {
          kind: 'not',
          operand: operand.ast,
        },
      };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ParseResult {
    const token = this.peek();

    if (!token) {
      return {
        ok: false,
        message: 'The formula ended too early.',
        position: this.tokens[this.tokens.length - 1]?.index ?? 0,
      };
    }

    if (token.type === 'lparen') {
      this.pointer += 1;
      const expression = this.parseIff();
      if (!expression.ok) {
        return expression;
      }

      const closing = this.peek();
      if (!closing || closing.type !== 'rparen') {
        return {
          ok: false,
          message: 'Missing a closing parenthesis.',
          position: closing?.index ?? token.index + 1,
        };
      }

      this.pointer += 1;
      return expression;
    }

    if (token.type === 'variable') {
      this.pointer += 1;
      return {
        ok: true,
        ast: {
          kind: 'variable',
          name: token.value,
        },
      };
    }

    if (token.type === 'rparen') {
      return {
        ok: false,
        message: 'There is a closing parenthesis without a matching opening parenthesis.',
        position: token.index,
      };
    }

    return {
      ok: false,
      message: 'Expected a sentence letter or a parenthesized formula.',
      position: token.index,
    };
  }

  private peek() {
    return this.tokens[this.pointer];
  }

  private matchOperator(operator: OperatorTokenValue) {
    const token = this.peek();
    if (token?.type === 'operator' && token.value === operator) {
      this.pointer += 1;
      return true;
    }

    return false;
  }
}

export function parseFormula(input: string): ParseResult {
  const tokens = tokenize(input.trim());
  if (!Array.isArray(tokens)) {
    return tokens;
  }

  return new Parser(tokens).parse();
}

export function isFormulaString(input: string) {
  return parseFormula(input).ok;
}

export function parseOrThrow(input: string): FormulaNode {
  const parsed = parseFormula(input);
  if (!parsed.ok) {
    throw new Error(`${parsed.message} (position ${parsed.position})`);
  }

  return parsed.ast;
}
