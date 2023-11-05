import { setCallback, StateMachine, transitionStateMachine } from "./statemachine";

export class MouseStateMachine implements StateMachine {
  current: string;
  states: Record<string, Record<string, string>>
  actions: Record<string, (args: any[]) => void>
  startX = -1;
  startY = -1;
  endX = 0;
  endY = 0;
  startCallback: (() => void) | null = null;
  moveCallback: ((x1: number, y1: number, x2: number, y2: number) => void) | null = null;

  constructor() {
    this.current = 'wait';
    this.actions = {};
    this.states = {
      'wait': { // waiting to start recording
        'down': 'record_mouse',
        'background': 'background_select',
        'push': 'push',
        'zoomOut': 'zoomOut',
        'clear': 'clear',
        'opacity': 'opacity_select',
      },
      'push': {
        'done': 'wait',
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
        'reveal': 'reveal',
        'zoomIn': 'zoomIn',
        'background': 'background_select',
        'wait': 'wait',
      },
      'obscure': {
        'wait': 'wait',
      },
      'reveal': {
        'wait': 'wait',
      },
      'zoomIn': {
        'wait': 'wait',
      },
      'zoomOut': {
        'wait': 'wait',
      },
      'background_select': {
        'link': 'background_link',
        'upload': 'background_upload',
        'down': 'record_mouse',
      },
      'background_link': {
        'done': 'wait',
      },
      'background_upload': {
        'done': 'wait',
      },
      'clear': {
        'done': 'wait',
      },
      'opacity_select': {
        'display': 'opacity_display',
        'render': 'opacity_render',
        'down': 'record_mouse',
      },
      'opacity_display': {
        'down': 'record_mouse',
        'change': 'update_display_opacity',
        'wait': 'wait',
      },
      'update_display_opacity': {
        'down': 'record_mouse',
        'change': 'update_display_opacity',
        'wait': 'wait',
      },
      'opacity_render': {
        'down': 'record_mouse',
        'change': 'update_render_opacity',
        'wait': 'wait',
      },
      'update_render_opacity': {
        'down': 'record_mouse',
        'change': 'update_render_opacity',
        'wait': 'wait',
      },
    };
    setCallback(this, 'record_mouse', this.doRecord);
  }

  transition(input: string, ...args: any[]): void {
    if (this.current === 'complete' && input === 'down') this.resetCoordinates();
    transitionStateMachine(this, input, args[0]);
  }

  doRecord(args: any[]) {
    // process consumer record callback first
    if ('record' in this.actions) this.actions['record'](args);

    // deal with recording mouse events
    const evt: MouseEvent = args[0];
    if (this.startX < 0) {
      this.startX = evt.offsetX;
      this.startY = evt.offsetY;
      if (this.startCallback) this.startCallback();
    } else {
      this.endY = evt.offsetY;
      this.endX = evt.offsetX;
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