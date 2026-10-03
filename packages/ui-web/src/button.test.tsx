import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, IconButton } from './button';

describe('web buttons', () => {
  it('renders a named button', () => {
    render(<Button>Continue</Button>);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button).toHaveProperty('disabled', false);
  });

  it('requires an accessible name for icon buttons', () => {
    render(<IconButton label="Switch theme">T</IconButton>);
    const button = screen.getByRole('button', { name: 'Switch theme' });
    expect(button).toHaveProperty('disabled', false);
  });
});
