import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuccessToast } from './SuccessToast';

describe('SuccessToast', () => {
    it('renders the message and alert role', () => {
        const onClose = vi.fn();
        render(<SuccessToast message="Saved successfully" onClose={onClose} />);
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Saved successfully');
    });

    it('calls onClose when the close button is clicked', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<SuccessToast message="Done" onClose={onClose} duration={60_000} />);
        await user.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
