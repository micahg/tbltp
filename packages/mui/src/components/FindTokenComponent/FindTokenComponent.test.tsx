import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FindTokenComponent from './FindTokenComponent';

describe('<FindTokenComponent />', () => {
  test('it should mount', () => {
    render(<FindTokenComponent />);

    const findTokenComponent = screen.getByTestId('FindTokenComponent');

    expect(findTokenComponent).toBeInTheDocument();
  });
});