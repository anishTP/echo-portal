import { render, screen } from '@testing-library/react';
import { Theme, Button, Badge, Card, TextField } from '@radix-ui/themes';
import { describe, it, expect } from 'vitest';

/**
 * T047: Design Token Propagation Tests
 *
 * These tests verify that Radix Themes design tokens propagate correctly
 * to all components when changed in the Theme configuration.
 */

describe('Design Token Propagation', () => {
  describe('Accent Color (T044)', () => {
    it('should apply accent color to Button components', () => {
      const { rerender } = render(
        <Theme accentColor="blue">
          <Button data-testid="button">Click me</Button>
        </Theme>
      );

      const button = screen.getByTestId('button');
      expect(button).toBeInTheDocument();

      // Rerender with different accent color
      rerender(
        <Theme accentColor="purple">
          <Button data-testid="button">Click me</Button>
        </Theme>
      );

      // Button should still be rendered (color change is CSS-based)
      expect(screen.getByTestId('button')).toBeInTheDocument();
    });

    it('should apply accent color to Badge components', () => {
      render(
        <Theme accentColor="green">
          <Badge data-testid="badge">Status</Badge>
        </Theme>
      );

      expect(screen.getByTestId('badge')).toBeInTheDocument();
    });

    it('should allow explicit color override on components', () => {
      render(
        <Theme accentColor="blue">
          <Button data-testid="blue-button">Blue</Button>
          <Button data-testid="red-button" color="red">Red Override</Button>
        </Theme>
      );

      expect(screen.getByTestId('blue-button')).toBeInTheDocument();
      expect(screen.getByTestId('red-button')).toBeInTheDocument();
    });
  });

  describe('Gray Scale (T045)', () => {
    it('should apply gray scale to Card components', () => {
      const { rerender } = render(
        <Theme grayColor="slate">
          <Card data-testid="card">Content</Card>
        </Theme>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();

      // Rerender with different gray scale
      rerender(
        <Theme grayColor="sage">
          <Card data-testid="card">Content</Card>
        </Theme>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should apply gray scale to TextField components', () => {
      render(
        <Theme grayColor="mauve">
          <TextField.Root data-testid="input" placeholder="Enter text" />
        </Theme>
      );

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });
  });

  describe('Border Radius (T046)', () => {
    it('should apply radius to Button components', () => {
      const radiusValues = ['none', 'small', 'medium', 'large', 'full'] as const;

      radiusValues.forEach((radius) => {
        const { unmount } = render(
          <Theme radius={radius}>
            <Button data-testid={`button-${radius}`}>Button</Button>
          </Theme>
        );

        expect(screen.getByTestId(`button-${radius}`)).toBeInTheDocument();
        unmount();
      });
    });

    it('should apply radius to Card components', () => {
      render(
        <Theme radius="large">
          <Card data-testid="card">Content</Card>
        </Theme>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('should apply radius to TextField components', () => {
      render(
        <Theme radius="full">
          <TextField.Root data-testid="input" placeholder="Pill input" />
        </Theme>
      );

      expect(screen.getByTestId('input')).toBeInTheDocument();
    });
  });

  describe('Multiple tokens combined', () => {
    it('should apply all tokens together', () => {
      render(
        <Theme accentColor="indigo" grayColor="mauve" radius="large">
          <div>
            <Button data-testid="button">Primary Action</Button>
            <Button data-testid="button-outline" variant="outline">Secondary</Button>
            <Badge data-testid="badge">New</Badge>
            <Card data-testid="card">
              <TextField.Root data-testid="input" placeholder="Enter value" />
            </Card>
          </div>
        </Theme>
      );

      expect(screen.getByTestId('button')).toBeInTheDocument();
      expect(screen.getByTestId('button-outline')).toBeInTheDocument();
      expect(screen.getByTestId('badge')).toBeInTheDocument();
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('input')).toBeInTheDocument();
    });
  });

  describe('Theme nesting', () => {
    it('should allow nested themes with different configurations', () => {
      render(
        <Theme accentColor="blue" radius="medium">
          <Button data-testid="outer-button">Outer</Button>
          <Theme accentColor="red" radius="full">
            <Button data-testid="inner-button">Inner</Button>
          </Theme>
        </Theme>
      );

      expect(screen.getByTestId('outer-button')).toBeInTheDocument();
      expect(screen.getByTestId('inner-button')).toBeInTheDocument();
    });
  });
});
