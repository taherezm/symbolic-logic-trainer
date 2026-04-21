# Symbolic Logic Trainer

Local beginner trainer for propositional logic. The product is built for repetition, not long lessons: see a prompt, answer, get graded immediately, read a short correction if needed, continue.

## What symbolic logic is

This app trains **propositional logic**. In propositional logic, whole statements are represented by sentence letters such as `P`, `Q`, and `R`.

The app covers these connectives:

- `¬P`: not `P`
- `P ∧ Q`: `P` and `Q`
- `P ∨ Q`: `P` or `Q` (inclusive OR)
- `P → Q`: if `P`, then `Q`
- `P ↔ Q`: `P` if and only if `Q`

It does not cover predicate logic in v1.

## Training scope

Seeded content:

- 60 truth-value drills
- 50 translation drills
- 30 validity questions
- 25 proof-step questions

Curriculum order:

1. sentence letters
2. negation
3. conjunction
4. disjunction
5. conditionals
6. biconditionals
7. mixed truth-value work
8. simple translation
9. conditional-heavy translation
10. validity basics
11. proof basics

## How the app works

The app runs one main practice loop:

1. pick the next due or high-value exercise
2. accept an answer
3. grade it deterministically
4. show short feedback
5. update progress
6. move to the next rep

Exercise types:

- **Truth-value drills**: evaluate a formula under a given assignment
- **English -> symbolic**: translate an English sentence into a formula
- **Symbolic -> English**: choose the best English rendering
- **Validity**: decide whether premises force a conclusion
- **Proof step**: choose the single best next move from four options

The interface is keyboard-friendly:

- `T` / `F` for truth-value drills
- `V` / `I` for validity
- `1` through `4` for multiple-choice items
- `Enter` to submit typed formulas and continue

The UI supports light mode and dark mode. Theme choice is stored locally.

## Logic engine

The logic engine is deterministic. It does not use heuristic grading for formulas.

Core responsibilities:

- parse formulas with `¬`, `∧`, `∨`, `→`, `↔`
- accept common ASCII input such as `~`, `!`, `&`, `^`, `|`, `->`, `<->`, `=>`, `<=>`
- accept word operators such as `not`, `and`, `or`, `iff`
- validate syntax and report parse errors
- evaluate formulas under truth assignments
- build evaluation traces for step-by-step truth-value feedback
- test logical equivalence where needed
- test validity by searching for counterexample rows

Operator precedence:

1. negation
2. conjunction
3. disjunction
4. conditional
5. biconditional

## Grading model

Grading is exercise-specific:

- truth-value answers are checked against direct formula evaluation
- English -> symbolic answers are parsed, normalized, and compared structurally
- equivalent-but-wrong-form translations can still be rejected if they miss the sentence structure being trained
- validity answers are checked by counterexample search
- proof-step and symbolic -> English questions use fixed answer keys with targeted feedback

Feedback is short and mistake-focused. It targets issues such as:

- reversed conditionals
- misunderstanding `only if`
- confusing sufficient and necessary conditions
- treating `∨` as exclusive OR
- affirming the consequent
- denying the antecedent
- illegal or unhelpful proof moves

## Review and progress

Progress is stored in browser `localStorage`. There is no backend.

The review loop is simple:

- missed items return sooner
- correct streaks push items farther out
- weaker skills are weighted more heavily
- unlocked curriculum stages depend on total correct answers

Tracked skill buckets:

- sentence letters
- negation
- conjunction
- disjunction
- conditionals
- biconditionals
- translation
- validity
- proofs

## Project structure

```text
src/
  App.tsx              main trainer UI
  styles.css           visual system, including light/dark theme
  data/                seeded exercise banks
  logic/               parser, AST, evaluator, equivalence and validity checks
  lib/                 grading, progress storage, adaptive scheduler
  types.ts             shared exercise and progress types
tests/
  logic.test.ts        parser and engine tests
  content.test.ts      seeded content integrity tests
  app.test.tsx         practice-flow and UI behavior tests
  scheduler.test.ts    review-loop tests
```
