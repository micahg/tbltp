export interface StateMachine {
  current: string;
  states: Record<string, Record<string, string>>;
  actions: Record<string, (args: unknown[]) => void>;
  transition(input: string, ...args: unknown[]): void;
}

/**
 * Generic state machine transition method
 *
 * @param sm a state machine
 * @param input the input to the current state
 * @param args extra arguments for the implementing class.
 * @returns true if the transition between states succeeds, otherwise, false.
 */
export function transitionStateMachine(
  sm: StateMachine,
  input: string,
  ...args: unknown[]
): boolean {
  // yes this could crash but not unless something has really gone wrong
  const current = sm.states[sm.current];
  if (!current) {
    console.error(`Current state undefined: ${sm.current}`);
    return false;
  }
  if (!(input in sm.states[sm.current])) return false;

  sm.current = sm.states[sm.current][input];

  if (sm.current in sm.actions && args) {
    sm.actions[sm.current].bind(sm)(args);
  }

  return true;
}

export function setCallback(
  sm: StateMachine,
  state: string,
  cb: (args: unknown[]) => void,
) {
  sm.actions[state] = cb;
}
