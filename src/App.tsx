import { startTransition, useEffect, useRef, useState } from 'react';
import { exerciseBank, exerciseCounts } from './data';
import {
  buildTruthValueReview,
  buildValidityReview,
  gradeExercise,
} from './lib/grading';
import {
  accuracyForSkill,
  createEmptyProgress,
  loadProgress,
  resetProgress,
  saveProgress,
  applyOutcome,
} from './lib/progress';
import { getUnlockedStageIndex, pickNextExercise } from './lib/scheduler';
import {
  SKILL_LABELS,
  STAGE_LABELS,
  STAGE_ORDER,
  type ExerciseOutcome,
  type ExerciseRecord,
  type ProgressState,
  type SkillKey,
  type TruthValueExercise,
} from './types';

const OPERATOR_BUTTONS = ['¬', '∧', '∨', '→', '↔', '(', ')'];
const THEME_STORAGE_KEY = 'symbolic-logic-trainer-theme-v1';
const SKILL_ORDER: SkillKey[] = [
  'negation',
  'conjunction',
  'disjunction',
  'conditionals',
  'biconditionals',
  'translation',
  'validity',
  'proofs',
];

const KNOWN_RULES = [
  'Modus Ponens',
  'Modus Tollens',
  'Simplification',
  'Conjunction',
  'Disjunctive Syllogism',
  'Hypothetical Syllogism',
  'Biconditional',
];

const NOTATION_GUIDE = [
  { symbol: '¬', meaning: 'not' },
  { symbol: '∧', meaning: 'and' },
  { symbol: '∨', meaning: 'inclusive or' },
  { symbol: '→', meaning: 'if ... then' },
  { symbol: '↔', meaning: 'if and only if' },
];

type ThemeMode = 'light' | 'dark';

function createInitialState() {
  const progress =
    typeof window === 'undefined' ? createEmptyProgress() : loadProgress();
  return {
    progress,
    currentExerciseId: pickNextExercise(exerciseBank, progress).id,
  };
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function formatPercent(value: number | null) {
  if (value === null) {
    return 'New';
  }

  return `${Math.round(value * 100)}%`;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
}

function appHeaderSubtitle(progress: ProgressState) {
  return `${progress.session.answered} answered • ${progress.session.correct} correct`;
}

function truthWord(value: boolean) {
  return value ? 'True' : 'False';
}

function describeTruthAssignments(assignment: Record<string, boolean>) {
  const entries = Object.entries(assignment).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  const parts = entries.map(
    ([symbol, value]) => `${symbol} has truth value ${truthWord(value)}`,
  );

  return entries.length === 1
    ? `Read the table as an assignment, not an equation: ${parts[0]}.`
    : `Read the table as assignments, not equations: ${parts.join('; ')}.`;
}

function extractRuleLabel(label: string) {
  return KNOWN_RULES.find((rule) => label.includes(rule)) ?? null;
}

function getExerciseGuide(exercise: ExerciseRecord) {
  if (exercise.type === 'truth-value') {
    let tip = 'A single sentence letter simply takes the truth value shown in the table.';

    if (exercise.skills.includes('conditionals')) {
      tip = 'For P → Q, there is only one false case: P is true and Q is false.';
    } else if (exercise.skills.includes('biconditionals')) {
      tip = 'A biconditional is true when both sides have the same truth value.';
    } else if (exercise.skills.includes('disjunction')) {
      tip = '∨ is inclusive OR: it is true when at least one side is true.';
    } else if (exercise.skills.includes('conjunction')) {
      tip = '∧ is true only when both sides are true.';
    } else if (exercise.skills.includes('negation')) {
      tip = 'Negation flips a truth value: if P is true, then ¬P is false.';
    }

    return {
      format: 'Answer format: choose True or False.',
      tip,
    };
  }

  if (exercise.type === 'english-to-symbolic') {
    const tip = exercise.skills.includes('conditionals')
      ? 'Find the condition first. “P only if Q” means P → Q, while “P if Q” means Q → P.'
      : exercise.skills.includes('disjunction')
        ? '∨ is inclusive OR unless the English explicitly rules out both.'
        : 'Match the sentence letters first, then choose the main connective.';

    return {
      format: 'Answer format: type a symbolic formula using the legend.',
      tip,
    };
  }

  if (exercise.type === 'symbolic-to-english') {
    const tip = exercise.skills.includes('conditionals')
      ? 'Watch arrow direction carefully. Reverse-condition mistakes are the most common error here.'
      : 'Translate the main connective first, then attach the sentence meanings from the legend.';

    return {
      format: 'Answer format: choose the single best English translation.',
      tip,
    };
  }

  if (exercise.type === 'validity') {
    return {
      format: 'Answer format: choose Valid or Invalid.',
      tip: 'Valid means there is no possible case with true premises and a false conclusion. Invalid means at least one counterexample row exists.',
    };
  }

  return {
    format: 'Answer format: choose the single best next line.',
    tip: 'Pick a line that is legal now and moves toward the goal. A statement can be true without being a licensed proof step.',
  };
}

export default function App() {
  const initialRef = useRef<ReturnType<typeof createInitialState>>();
  if (!initialRef.current) {
    initialRef.current = createInitialState();
  }

  const [progress, setProgress] = useState<ProgressState>(initialRef.current.progress);
  const [currentExerciseId, setCurrentExerciseId] = useState(initialRef.current.currentExerciseId);
  const [textAnswer, setTextAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  const inputRef = useRef<HTMLInputElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const progressRef = useRef(initialRef.current.progress);
  const currentExercise = exerciseBank.find((exercise) => exercise.id === currentExerciseId)!;
  const unlockedStageIndex = getUnlockedStageIndex(progress);
  const guide = getExerciseGuide(currentExercise);

  useEffect(() => {
    progressRef.current = progress;
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      return;
    }
  }, [theme]);

  useEffect(() => {
    if (!outcome && currentExercise.type === 'english-to-symbolic') {
      inputRef.current?.focus();
    }
  }, [currentExerciseId, outcome, currentExercise.type]);

  useEffect(() => {
    if (outcome) {
      continueButtonRef.current?.focus();
    }
  }, [outcome]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (outcome) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goToNext();
        }
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (currentExercise.type === 'truth-value') {
        if (event.key.toLowerCase() === 't') {
          submitAnswer('true');
        }
        if (event.key.toLowerCase() === 'f') {
          submitAnswer('false');
        }
      }

      if (currentExercise.type === 'validity') {
        if (event.key.toLowerCase() === 'v') {
          submitAnswer('valid');
        }
        if (event.key.toLowerCase() === 'i') {
          submitAnswer('invalid');
        }
      }

      if (currentExercise.type === 'symbolic-to-english' || currentExercise.type === 'proof-step') {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < currentExercise.options.length) {
          submitAnswer(currentExercise.options[index].id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentExercise, outcome]);

  function submitAnswer(answer: string) {
    if (outcome) {
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) {
      return;
    }

    const nextOutcome = gradeExercise(currentExercise, trimmed);
    setSubmittedAnswer(trimmed);
    setOutcome(nextOutcome);
    setProgress((previous) => applyOutcome(previous, currentExercise, nextOutcome.correct));
  }

  function goToNext() {
    startTransition(() => {
      const nextExercise = pickNextExercise(exerciseBank, progressRef.current);
      setCurrentExerciseId(nextExercise.id);
      setTextAnswer('');
      setSubmittedAnswer('');
      setOutcome(null);
    });
  }

  function insertOperator(symbol: string) {
    const input = inputRef.current;
    if (!input) {
      setTextAnswer((previous) => `${previous}${symbol}`);
      return;
    }

    const start = input.selectionStart ?? textAnswer.length;
    const end = input.selectionEnd ?? textAnswer.length;
    const nextValue = `${textAnswer.slice(0, start)}${symbol}${textAnswer.slice(end)}`;

    setTextAnswer(nextValue);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + symbol.length, start + symbol.length);
    });
  }

  function handleReset() {
    const confirmed = window.confirm(
      'Reset all local progress and start the trainer from the beginning?',
    );

    if (!confirmed) {
      return;
    }

    const empty = resetProgress();
    setProgress(empty);
    setCurrentExerciseId(pickNextExercise(exerciseBank, empty).id);
    setTextAnswer('');
    setSubmittedAnswer('');
    setOutcome(null);
  }

  function renderPromptCard(exercise: ExerciseRecord) {
    switch (exercise.type) {
      case 'truth-value':
        return (
          <>
            <div className="truth-layout">
              <div className="truth-panel">
                <span className="section-label">Truth-Value Table</span>
                <table className="logic-table">
                  <thead>
                    <tr>
                      <th>Sentence Letter</th>
                      <th>Truth Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(exercise.assignment)
                      .sort(([left], [right]) => left.localeCompare(right))
                      .map(([symbol, value]) => (
                        <tr key={symbol}>
                          <td className="logic-symbol">{symbol}</td>
                          <td>
                            <span className={`truth-badge ${value ? 'true' : 'false'}`}>
                              {truthWord(value)}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="truth-note">{describeTruthAssignments(exercise.assignment)}</p>
              </div>

              <div className="section-block">
                <span className="section-label">Whole Formula</span>
                <div className="formula-board">{exercise.formula}</div>
              </div>
            </div>
          </>
        );
      case 'english-to-symbolic':
        return (
          <>
            <div className="section-block">
              <span className="section-label">Legend</span>
              <div className="legend-list">
                {exercise.legend.map((entry) => (
                  <div key={entry.symbol} className="legend-row">
                    <strong>{entry.symbol}</strong>
                    <span>{entry.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
            <blockquote className="english-sentence">{exercise.sentence}</blockquote>
          </>
        );
      case 'symbolic-to-english':
        return (
          <>
            <div className="section-block">
              <span className="section-label">Legend</span>
              <div className="legend-list">
                {exercise.legend.map((entry) => (
                  <div key={entry.symbol} className="legend-row">
                    <strong>{entry.symbol}</strong>
                    <span>{entry.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="formula-board">{exercise.formula}</div>
          </>
        );
      case 'validity':
        return (
          <>
            <div className="argument-box">
              <div className="section-label">Premises</div>
              <ol className="line-list">
                {exercise.premises.map((premise) => (
                  <li key={premise}>{premise}</li>
                ))}
              </ol>
              <div className="goal-line">
                <span>Conclusion</span>
                <strong>{exercise.conclusion}</strong>
              </div>
            </div>
          </>
        );
      case 'proof-step':
        return (
          <>
            <div className="argument-box">
              <div className="section-label">Available Lines</div>
              <ol className="line-list">
                {exercise.premises.map((premise) => (
                  <li key={`premise-${premise}`}>{premise} <span className="line-tag">Premise</span></li>
                ))}
                {exercise.derived?.map((line) => (
                  <li key={`derived-${line}`}>{line} <span className="line-tag">Derived</span></li>
                ))}
              </ol>
              <div className="goal-line">
                <span>Goal</span>
                <strong>{exercise.goal}</strong>
              </div>
            </div>
          </>
        );
    }
  }

  function renderTruthValueReview(exercise: TruthValueExercise) {
    const rows = buildTruthValueReview(exercise);

    return (
      <div className="section-block">
        <span className="section-label">Evaluation</span>
        <table className="logic-table evaluation-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Expression</th>
              <th>Truth Value</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.role === 'result' ? 'result-row' : undefined}>
                <td className="role-cell">{row.role}</td>
                <td className="logic-symbol">{row.expression}</td>
                <td>
                  <span className={`truth-badge ${row.value ? 'true' : 'false'}`}>
                    {truthWord(row.value)}
                  </span>
                </td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderValidityReview(exercise: Extract<ExerciseRecord, { type: 'validity' }>) {
    const review = buildValidityReview(exercise);
    if (!review) {
      return (
        <div className="section-block">
          <span className="section-label">Validity Check</span>
          <p className="truth-note">
            No counterexample row exists for this argument.
          </p>
        </div>
      );
    }

    return (
      <div className="section-block">
        <span className="section-label">Counterexample Row</span>
        <p className="truth-note">
          In this row, every premise is true and the conclusion is false: {review.assignmentSummary}.
        </p>
        <table className="logic-table evaluation-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Expression</th>
              <th>Truth Value</th>
            </tr>
          </thead>
          <tbody>
            {review.rows.map((row) => (
              <tr
                key={`${row.role}-${row.expression}`}
                className={row.role === 'Conclusion' ? 'result-row' : undefined}
              >
                <td className="role-cell">{row.role}</td>
                <td className="logic-symbol">{row.expression}</td>
                <td>
                  <span className={`truth-badge ${row.value ? 'true' : 'false'}`}>
                    {truthWord(row.value)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderResponseArea(exercise: ExerciseRecord) {
    if (exercise.type === 'truth-value') {
      return (
        <div className="binary-row">
          {[
            { label: 'True', value: 'true', keyHint: 'T' },
            { label: 'False', value: 'false', keyHint: 'F' },
          ].map((choice) => (
            <button
              key={choice.value}
              className={`choice-button ${outcome ? getBinaryClass(choice.value) : ''}`}
              disabled={Boolean(outcome)}
              onClick={() => submitAnswer(choice.value)}
            >
              <span>{choice.label}</span>
              <small>{choice.keyHint}</small>
            </button>
          ))}
        </div>
      );
    }

    if (exercise.type === 'english-to-symbolic') {
      return (
        <form
          className="translation-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer(textAnswer);
          }}
        >
          <input
            ref={inputRef}
            className="formula-input"
            value={textAnswer}
            onChange={(event) => setTextAnswer(event.target.value)}
            placeholder="Type a symbolic formula"
            disabled={Boolean(outcome)}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="operator-row">
            {OPERATOR_BUTTONS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className="operator-button"
                disabled={Boolean(outcome)}
                onClick={() => insertOperator(symbol)}
              >
                {symbol}
              </button>
            ))}
            <button
              type="button"
              className="operator-button ghost"
              disabled={Boolean(outcome)}
              onClick={() => setTextAnswer('')}
            >
              Clear
            </button>
          </div>
          <div className="submit-row">
            <button className="primary-button" type="submit" disabled={Boolean(outcome)}>
              Submit
            </button>
            <span className="hint-text">
              {'Enter submits. ASCII like `->` and `&` also works.'}
            </span>
          </div>
        </form>
      );
    }

    if (exercise.type === 'validity') {
      return (
        <div className="binary-row">
          {[
            { label: 'Valid', value: 'valid', keyHint: 'V' },
            { label: 'Invalid', value: 'invalid', keyHint: 'I' },
          ].map((choice) => (
            <button
              key={choice.value}
              className={`choice-button ${outcome ? getBinaryClass(choice.value) : ''}`}
              disabled={Boolean(outcome)}
              onClick={() => submitAnswer(choice.value)}
            >
              <span>{choice.label}</span>
              <small>{choice.keyHint}</small>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="option-list">
        {exercise.options.map((option, index) => (
          <button
            key={option.id}
            className={`option-button ${outcome ? getOptionClass(option.id, exercise.correctOptionId) : ''}`}
            disabled={Boolean(outcome)}
            onClick={() => submitAnswer(option.id)}
          >
            <span className="option-index">{index + 1}</span>
            <span className="option-copy">
              {exercise.type === 'proof-step' && extractRuleLabel(option.label) ? (
                <span className="option-rule">{extractRuleLabel(option.label)}</span>
              ) : null}
              <span>{option.label}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  function getBinaryClass(value: string) {
    if (!outcome) {
      return '';
    }

    const isCorrectAnswer =
      (currentExercise.type === 'truth-value' && outcome.expected?.toLowerCase() === (value === 'true' ? 'true' : 'false')) ||
      (currentExercise.type === 'validity' && outcome.expected?.toLowerCase() === value);

    if (submittedAnswer === value && !outcome.correct) {
      return 'wrong';
    }

    if (isCorrectAnswer) {
      return 'correct';
    }

    return '';
  }

  function getOptionClass(optionId: string, correctOptionId: string) {
    if (!outcome) {
      return '';
    }

    if (optionId === correctOptionId) {
      return 'correct';
    }

    if (submittedAnswer === optionId && !outcome.correct) {
      return 'wrong';
    }

    return '';
  }

  const accuracy =
    progress.session.answered === 0
      ? null
      : progress.session.correct / progress.session.answered;

  return (
    <main className="app-shell">
      <section className="dashboard-panel">
        <div className="dashboard-head">
          <div>
            <p className="eyebrow">Local Symbolic Logic Trainer</p>
            <h1>Beginner propositional practice</h1>
            <p className="panel-copy">
              One focused loop: answer, get graded instantly, learn the exact mistake, keep moving.
            </p>
          </div>
          <div className="theme-toggle" role="group" aria-label="Theme">
            {(['light', 'dark'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`theme-button ${theme === mode ? 'active' : ''}`}
                aria-pressed={theme === mode}
                onClick={() => setTheme(mode)}
              >
                {mode === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card">
            <span>Session</span>
            <strong>{progress.session.answered}</strong>
            <small>{appHeaderSubtitle(progress)}</small>
          </div>
          <div className="stat-card">
            <span>Accuracy</span>
            <strong>{accuracy === null ? 'New' : `${Math.round(accuracy * 100)}%`}</strong>
            <small>{progress.session.streak} in a row</small>
          </div>
          <div className="stat-card">
            <span>Unlocked Stage</span>
            <strong>{STAGE_LABELS[STAGE_ORDER[unlockedStageIndex]]}</strong>
            <small>{exerciseCounts.truthValue + exerciseCounts.translation + exerciseCounts.validity + exerciseCounts.proofs} seeded reps</small>
          </div>
        </div>
        <div className="skill-strip">
          {SKILL_ORDER.map((skill) => (
            <div key={skill} className="skill-pill">
              <span>{SKILL_LABELS[skill]}</span>
              <strong>{formatPercent(accuracyForSkill(progress, skill))}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="trainer-card">
        <div className="card-top">
          <div>
            <p className="eyebrow">{STAGE_LABELS[currentExercise.stage]}</p>
            <h2>{currentExercise.title}</h2>
            <p className="prompt-text">{currentExercise.prompt}</p>
          </div>
          <button className="reset-button" onClick={handleReset}>
            Reset Progress
          </button>
        </div>

        <div className="guide-strip">
          <div className="guide-card">
            <span className="section-label">Answer Format</span>
            <p>{guide.format}</p>
          </div>
          <div className="guide-card">
            <span className="section-label">Coach Note</span>
            <p>{guide.tip}</p>
          </div>
        </div>

        <div className="notation-strip" aria-label="Notation key">
          {NOTATION_GUIDE.map((entry) => (
            <div key={entry.symbol} className="notation-card">
              <span className="notation-symbol">{entry.symbol}</span>
              <span>{entry.meaning}</span>
            </div>
          ))}
        </div>

        {renderPromptCard(currentExercise)}

        <div className="answer-panel">{renderResponseArea(currentExercise)}</div>

        {currentExercise.type === 'truth-value' && outcome
          ? renderTruthValueReview(currentExercise)
          : null}

        {currentExercise.type === 'validity' && outcome
          ? renderValidityReview(currentExercise)
          : null}

        <div
          className={`feedback-panel ${outcome ? (outcome.correct ? 'success' : 'error') : 'idle'}`}
          aria-live="polite"
        >
          {outcome ? (
            <>
              <div className="feedback-copy">
                <strong>{outcome.correct ? 'Correct.' : 'Not quite.'}</strong>
                <p>{outcome.feedback}</p>
                {!outcome.correct && outcome.expected ? (
                  <p className="expected-line">Expected: {outcome.expected}</p>
                ) : null}
              </div>
              <button
                ref={continueButtonRef}
                className="primary-button"
                onClick={goToNext}
              >
                Continue
              </button>
            </>
          ) : (
            <p className="hint-text">
              {currentExercise.type === 'truth-value' && 'Use the buttons or press T / F.'}
              {currentExercise.type === 'english-to-symbolic' && 'Type the formula, then press Enter.'}
              {currentExercise.type === 'symbolic-to-english' && 'Choose the best translation. Number keys 1-4 also work.'}
              {currentExercise.type === 'validity' && 'Decide whether the premises force the conclusion. Press V / I if you like.'}
              {currentExercise.type === 'proof-step' && 'Pick the strongest legal next move. Number keys 1-4 also work.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
