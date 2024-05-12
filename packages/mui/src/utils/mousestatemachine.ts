import {
  setCallback,
  StateMachine,
  transitionStateMachine,
} from "./statemachine";

export class MouseStateMachine implements StateMachine {
  current: string;
  states: Record<string, Record<string, string>>;
  actions: Record<string, (args: unknown[]) => void>;
  buttons = 0;
  startX = -1;
  startY = -1;
  endX = 0;
  endY = 0;
  moveCallback: ((buttons: number, x: number, y: number) => void) | null = null;

  constructor() {
    this.current = "wait";
    this.actions = {};
    /**
     * DO NOT ADD STATES...
     *
     * Or at least think long and hard before you do. First of all, most of the activity here happens
     * between wait (nothing happening), recording (mouse is moving and we care what it does), and done
     * (selection complete).
     *
     * Stuff like obscure, reveal, zoom, etc probably don't need to be here, but we'll keep it for now.
     *
     * Also, remember that selection needs "complete" because reveal, obscure, zoom in should only happen
     * with a selection on screen. When the "end select" button is pressed, we'll go from complete to
     * wait, and those select-dependent actions are disabled.
     *
     * Finally, there is some finicky behavior around recording. Typically we're always recording movement
     * but the other state machines (the internal state of the content editor, for example) choose if
     * they will listen to the events or not. For example, while painting, we render a translucent cursor
     * when no mouse buttons are pressed. So when the paint tool is selected, the editor always uses the
     * event. Selecting, however, really only wants events while the mouse button is down. When no buttons
     * are depressed, the record events are ignored. This class will never know that though - it just records
     * until its told to stop.
     */
    this.states = {
      // before anything happens
      wait: {
        push: "push",
        background: "background_select",
        remoteZoomOut: "remoteZoomOut",
        clear: "clear",
        down: "record_mouse",
        record: "record_mouse",
        opacity: "opacity_select",
        rotateClock: "rotate_clock",
        wheel: "zoom",
      },
      // after select or paint is done
      complete: {
        down: "record_mouse", // canvas interaction with no tool selected (pan/zoom)
        background: "background_select",
        record: "record_mouse",
        obscure: "obscure",
        reveal: "reveal",
        remoteZoomIn: "remoteZoomIn",
        wait: "wait",
      },
      push: {
        done: "wait",
      },
      record_mouse: {
        // recording movement
        move: "record_mouse",
        up: "complete",
        out: "complete",
        down: "record_mouse",
        wait: "wait", // for situations like paint->record_mouse where we show translucent brush
        wheel: "record_mouse_wheel",
      },
      record_mouse_wheel: {
        done: "record_mouse",
      },
      obscure: {
        obscured: "record_mouse",
      },
      reveal: {
        revealed: "record_mouse",
      },
      // LOCAL EDITOR ZOOM
      zoom: {
        wait: "wait",
      },
      // REMOTE DISPLAY ZOOMS
      remoteZoomIn: {
        zoomed: "record_mouse",
      },
      remoteZoomOut: {
        wait: "wait",
      },
      background_select: {
        link: "background_link",
        upload: "background_upload",
        down: "record_mouse",
      },
      background_link: {
        done: "wait",
      },
      background_upload: {
        done: "wait",
      },
      clear: {
        done: "wait",
      },
      opacity_select: {
        display: "opacity_display",
        render: "opacity_render",
        down: "record_mouse",
      },
      opacity_display: {
        down: "record_mouse",
        change: "update_display_opacity",
        wait: "wait",
      },
      update_display_opacity: {
        down: "record_mouse",
        change: "update_display_opacity",
        wait: "wait",
      },
      opacity_render: {
        down: "record_mouse",
        change: "update_render_opacity",
        wait: "wait",
      },
      update_render_opacity: {
        down: "record_mouse",
        change: "update_render_opacity",
        wait: "wait",
      },
      rotate_clock: {
        done: "wait",
      },
    };
    setCallback(this, "record_mouse", this.doRecord);
  }

  transition(input: string, ...args: unknown[]): void {
    if (this.current === "complete" && input === "down")
      this.resetCoordinates();
    transitionStateMachine(this, input, args[0]);
  }

  doRecord(args: unknown[]) {
    // process consumer record callback first
    if ("record" in this.actions) this.actions["record"](args);

    // deal with recording mouse events
    // const evt: MouseEvent = args[0];
    const evt = args[0];
    // there has got to be a better way
    if (
      !evt ||
      typeof evt !== "object" ||
      !("offsetX" in evt) ||
      !("offsetY" in evt) ||
      !("buttons" in evt) ||
      typeof evt.buttons !== "number" ||
      typeof evt.offsetX !== "number" ||
      typeof evt.offsetY !== "number"
    ) {
      return;
    }
    if (this.moveCallback)
      this.moveCallback(evt.buttons, evt.offsetX, evt.offsetY);
  }

  public resetCoordinates() {
    this.startX = -1;
    this.startY = -1;
    this.endX = -1;
    this.endY = -1;
  }

  // public getCoordinates() { return [this.startX, this.startY, this.endX, this.endY]; }
  public x1() {
    return this.startX;
  }
  public x2() {
    return this.endX;
  }
  public y1() {
    return this.startY;
  }
  public y2() {
    return this.endY;
  }

  public setMoveCallback(cb: (buttons: number, x: number, y: number) => void) {
    this.moveCallback = cb;
  }
}
