import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import SceneComponent from './SceneComponent';

describe('<SceneComponent />', () => {
  test('it should mount', () => {
    render(<SceneComponent />);
    
    const sceneComponent = screen.getByTestId('SceneComponent');

    expect(sceneComponent).toBeInTheDocument();
  });
});