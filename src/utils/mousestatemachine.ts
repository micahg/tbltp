import { StateMachine, transitionStateMachine } from "./statemachine";

export class MouseStateMachine implements StateMachine {
  current: string;
  states: Record<string, Record<string, string>>
  actions: Record<string, (args: any[]) => void>
  startX: number = -1;
  startY: number = -1;
  endX: number = 0;
  endY: number = 0;
  startCallback: (() => void) | null = null;
  moveCallback: ((x1: number, y1: number, x2: number, y2: number) => void) | null = null;
  selectedCallback: ((x1: number, y1: number, x2: number, y2: number) => void) | null = null;

  constructor() {
    this.current = 'wait';
    this.states = {
      'wait': { // waiting to start recording
        'down': 'record',
      },
      'record': { // recording movement
        'move': 'record',
        'up': 'complete',
        'out': 'complete',
        'down': 'record',
      },
      'complete': { // done recording
        'down': 'record',
      }
    };
    this.actions = {
      'record': this.doRecord,
      'complete': this.doComplete,
    }
  }

  transition(input: string, ...args: any[]): void { transitionStateMachine(this, input, args[0]); }

  doRecord(args: any[]) {
    let evt: MouseEvent = args[0];
    if (this.startX < 0) {
      this.startX = evt.x;
      this.startY = evt.y;
      if (this.startCallback) this.startCallback();
    } else {
      this.endY = evt.y;
      this.endX = evt.x;
      if (this.moveCallback) this.moveCallback(this.startX, this.startY, this.endX, this.endY)
    }
  }

  doComplete(args: any[]) {
    if (this.selectedCallback && this.startX !== this.endX && this.startY !== this.endY) {
      this.selectedCallback(this.startX, this.startY, this.endX, this.endY);
    }
    this.startX = -1;
    this.startY = -1;
    this.endX = -1;
    this.endY = -1
  }

  public setMoveCallback(cb: (x1: number, y1: number, x2: number, y2: number) => void) { this.moveCallback = cb; }
  public setStartCallback(cb: () => void) { this.startCallback = cb; }
  public setSelectedCallback(cb: (x1: number, y1: number, x2: number, y2: number) => void) { this.selectedCallback = cb; }
}