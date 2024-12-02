import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreateTokenFormComponent from './CreateTokenFormComponent';

describe('<CreateTokenFormComponent />', () => {
  test('it should mount', () => {
    render(<CreateTokenFormComponent />);

    const createTokenFormComponent = screen.getByTestId('CreateTokenFormComponent');

    expect(createTokenFormComponent).toBeInTheDocument();
  });
});