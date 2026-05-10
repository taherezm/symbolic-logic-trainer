import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App';

describe('trainer app', () => {
  it('grades the first drill and advances', async () => {
    window.localStorage.clear();

    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('group', { name: 'Practice mode' })).toBeInTheDocument();
    expect(screen.getByText('Truth-Value Table')).toBeInTheDocument();
    expect(screen.getByText(/assignment, not an equation/i)).toBeInTheDocument();
    expect(screen.getByText('Whole Formula')).toBeInTheDocument();
    expect(screen.getAllByText('P').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('True').length).toBeGreaterThanOrEqual(1);
    await user.click(screen.getByRole('button', { name: /true/i }));

    expect(await screen.findByText('Correct.')).toBeInTheDocument();
    expect(screen.getAllByText(/whole formula is just p/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Evaluation')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText(/use the truth-value table below/i)).toBeInTheDocument();
    expect(screen.queryByText('Correct.')).not.toBeInTheDocument();
  });

  it('toggles and persists theme mode', async () => {
    window.localStorage.clear();

    const user = userEvent.setup();
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Dark' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('symbolic-logic-trainer-theme-v1')).toBe('dark');
  });

  it('lets the user jump to another unit', async () => {
    window.localStorage.clear();

    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText('Jump to unit'), 'validity-basics');

    expect(await screen.findByText(/mode validity basics/i)).toBeInTheDocument();
    const validityHeading = screen.getByRole('heading', { name: 'Valid or Invalid' });
    const trainerCard = validityHeading.closest('section');
    expect(trainerCard).not.toBeNull();
    expect(within(trainerCard as HTMLElement).getByRole('button', { name: /^valid/i })).toBeInTheDocument();
    expect(within(trainerCard as HTMLElement).getByRole('button', { name: /^invalid/i })).toBeInTheDocument();
  });

  it('unlocks review misses after a wrong answer', async () => {
    window.localStorage.clear();

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /false/i }));
    expect(await screen.findByText('Not quite.')).toBeInTheDocument();

    const modePicker = screen.getByRole('group', { name: 'Practice mode' });
    const reviewButton = within(modePicker).getByRole('button', { name: /review misses \(1\)/i });
    expect(reviewButton).toBeEnabled();

    await user.click(reviewButton);

    expect(screen.queryByText('Not quite.')).not.toBeInTheDocument();
    expect(screen.getByText(/mode review misses/i)).toBeInTheDocument();
  });

  it('starts a focused conditionals module', async () => {
    window.localStorage.clear();

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Conditionals Focus' }));

    expect(await screen.findByText(/mode conditionals focus/i)).toBeInTheDocument();
    expect(screen.getByText('P → Q')).toBeInTheDocument();
    expect(screen.getByText(/only one false case/i)).toBeInTheDocument();
  });
});
