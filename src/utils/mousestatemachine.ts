import { setCallback, StateMachine, transitionStateMachine } from "./statemachine";

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

  constructor() {
    this.current = 'wait';
    this.actions = {};
    this.states = {
      'wait': { // waiting to start recording
        'down': 'record_mouse',
        'background': 'background_select',
      },
      'record_mouse': { // recording movement
        'move': 'record_mouse',
        'up': 'complete',
        'out': 'complete',
        'down': 'record_mouse',
      },
      'complete': { // done recording - box selected
        'down': 'record_mouse',
        'obscure': 'obscure',
        'background': 'background_select',
      },
      'obscure': {
        'wait': 'wait',
      },
      'background_select': {
        'link': 'background_link',
        'upload': 'background_upload',
        'down': 'record_mouse',
        'cancel': 'wait',
      },
      'background_link': {
        'done': 'wait',
      },
      'background_upload': {
        'done': 'wait',
      }
    };
    setCallback(this, 'record_mouse', this.doRecord);
  }

  transition(input: string, ...args: any[]): void {
    if (this.current == 'complete' && input == 'down') this.resetCoordinates();
    transitionStateMachine(this, input, args[0]);
  }

  doRecord(args: any[]) {
    // process consumer record callback first
    if ('record' in this.actions) this.actions['record'](args);

    // deal with recording mouse events
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

  public resetCoordinates() {
    this.startX = -1;
    this.startY = -1;
    this.endX = -1;
    this.endY = -1
  }

  // public getCoordinates() { return [this.startX, this.startY, this.endX, this.endY]; }
  public x1() { return this.startX; }
  public x2() { return this.endX; }
  public y1() { return this.startY; }
  public y2() { return this.endY; }

  public setMoveCallback(cb: (x1: number, y1: number, x2: number, y2: number) => void) { this.moveCallback = cb; }
  public setStartCallback(cb: () => void) { this.startCallback = cb; }
}