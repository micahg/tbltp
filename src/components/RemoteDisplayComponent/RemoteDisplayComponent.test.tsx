import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import RemoteDisplayComponent from './RemoteDisplayComponent';

describe('<RemoteDisplayComponent />', () => {
  test('it should mount', () => {
    render(<RemoteDisplayComponent />);
    
    const remoteDisplayComponent = screen.getByTestId('RemoteDisplayComponent');

    expect(remoteDisplayComponent).toBeInTheDocument();
  });
});