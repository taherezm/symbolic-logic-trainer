import {
  checkArgumentValidityFromStrings,
  evaluateFormulaString,
  formatFormula,
  isEquivalentFormulaString,
  isTranslationEquivalent,
} from '../src/logic/engine';
import { parseOrThrow } from '../src/logic/parser';

describe('logic engine', () => {
  it('parses and formats formulas with standard symbols', () => {
    expect(formatFormula(parseOrThrow('P -> (Q and R)'))).toBe('P → (Q ∧ R)');
    expect(formatFormula(parseOrThrow('!(P v Q)'))).toBe('¬(P ∨ Q)');
  });

  it('treats spaced ascii v as OR without collapsing adjacent letters into operators', () => {
    expect(formatFormula(parseOrThrow('P v Q'))).toBe('P ∨ Q');
    expect(formatFormula(parseOrThrow('pvq'))).toBe('PVQ');
  });

  it('evaluates conditionals with the one false case', () => {
    expect(evaluateFormulaString('P -> Q', { P: true, Q: false })).toBe(false);
    expect(evaluateFormulaString('P -> Q', { P: false, Q: false })).toBe(true);
  });

  it('distinguishes logical equivalence from translation equivalence', () => {
    const direct = parseOrThrow('P -> Q');
    const contrapositive = parseOrThrow('¬Q -> ¬P');

    expect(isEquivalentFormulaString('P -> Q', '¬Q -> ¬P')).toBe(true);
    expect(isTranslationEquivalent(direct, contrapositive)).toBe(false);
  });

  it('finds counterexamples for invalid arguments', () => {
    const verdict = checkArgumentValidityFromStrings(['P -> Q', 'Q'], 'P');

    expect(verdict.valid).toBe(false);
    expect(verdict.counterexample).toEqual({ P: false, Q: true });
  });
});
