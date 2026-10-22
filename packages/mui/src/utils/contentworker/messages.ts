import { Rect } from "@micahg/tbltp-common";
import { createDrawable, DrawableToken } from "../drawing";
import {
  createPoints,
  normalizeRect,
  pointsFromRect,
  rectFromPoints,
  rot,
} from "../geometry";
import {
  clearBox,
  clearCanvas,
  eraseBrush,
  fullRerender,
  renderAllCanvases,
  renderBox,
  renderBrush,
  renderDisplay,
  renderToken,
  storeOverlay,
} from "./render";
import { applyUpdate } from "./scene";
import type { WorkerPost, WorkerState } from "./state";
import { GUIDE_FILL, MIN_BRUSH, ZOOM_STEP } from "./state";
import { renderThings, thingAt } from "./things";
import {
  adjustZoom,
  adjustZoomFromViewport,
  calculateViewport,
  trimPanning,
  unrotateScaleTranslatePoints,
} from "./viewport";

function resetPointer(state: WorkerState): void {
  state.tools.pointer.lastAnimX = -1;
  state.tools.pointer.lastAnimY = -1;
  state.tools.pointer.startX = -1;
  state.tools.pointer.startY = -1;
  state.tools.pointer.endX = -1;
  state.tools.pointer.endY = -1;
}

function animateBrush(state: WorkerState): void {
  if (!state.tools.recording) return;
  renderDisplay(state);
  renderBrush(
    state,
    state.tools.pointer.startX,
    state.tools.pointer.startY,
    state.tools.brush,
    false,
  );
  requestAnimationFrame(() => animateBrush(state));
}

function animateToken(state: WorkerState): void {
  if (!state.tools.recording) return;
  if (!state.tools.token) return;
  renderDisplay(state);
  renderToken(state.layers.visible, state.tools.token, state.view.zoom, true);
  requestAnimationFrame(() => animateToken(state));
}

function animateAllTokens(state: WorkerState): void {
  if (!state.tools.recording) return;
  // rerender the things
  renderThings(state.layers.things, state.things);

  // rerender to the overlay (remember image canvasses includes the things canvas)
  renderDisplay(state);
  requestAnimationFrame(() => animateAllTokens(state));
}

function animateSelection(state: WorkerState): void {
  if (!state.tools.recording) return;
  const { tools, view } = state;
  if (tools.selecting) {
    renderDisplay(state);
    renderBox(
      state,
      tools.pointer.startX,
      tools.pointer.startY,
      tools.pointer.endX,
      tools.pointer.endY,
      GUIDE_FILL,
      false,
    );
  } else if (tools.panning) {
    if (view.zoom === undefined) {
      requestAnimationFrame(() => animateSelection(state));
      return;
    }
    // calculate the (rotated) movement since the last frame and update for the next
    const [w, h] = rot(
      -view.angle,
      tools.pointer.endX - tools.pointer.lastAnimX,
      tools.pointer.endY - tools.pointer.lastAnimY,
    );
    tools.pointer.lastAnimX = tools.pointer.endX;
    tools.pointer.lastAnimY = tools.pointer.endY;

    // move the panning offsets
    view.image.x += Math.round((w * view.maxZoom) / view.zoom);
    view.image.y += Math.round((h * view.maxZoom) / view.zoom);

    // ensure panning offsets are within image boundaries
    const background = state.layers.background;
    if (background) {
      trimPanning(view.image, background.width, background.height);
    }

    renderDisplay(state);
  }
  requestAnimationFrame(() => animateSelection(state));
}

export async function dispatch(
  state: WorkerState,
  evt: MessageEvent,
  post: WorkerPost,
): Promise<void> {
  console.log(evt.data.cmd);
  switch (evt.data.cmd) {
    case "init": {
      // ensure the visible canvas is valid
      const offCanvas = evt.data.canvas as OffscreenCanvas | undefined;
      if (!offCanvas) {
        console.error(
          `ERROR: PORK CHOP SANDWICHES - no canvas in contentworker init`,
        );
        return;
      }

      state.view.canvas.width = offCanvas.width;
      state.view.canvas.height = offCanvas.height;

      state.layers.visible = offCanvas.getContext("2d", {
        alpha: false,
      }) as OffscreenCanvasRenderingContext2D;

      // indicate if things should be rendered on top of the overlay
      state.settings.thingsOnTop = !!evt.data.thingsOnTop;

      // set the initial display opacity of the overlay/things layers
      state.settings.displayOpacity =
        evt.data.displayOpacity ?? state.settings.displayOpacity;
      break;
    }
    case "update": {
      try {
        // TODO micah maybe check (or return from update) if there was actually a resize!?!?!?
        await applyUpdate(state, evt.data.values, post);

        post({ cmd: "updated" });

        // technically, because the background changed, we've resized due to the image changing size
        const background = state.layers.background;
        if (background) {
          post({
            cmd: "resized",
            width: state.view.viewport.width,
            height: state.view.viewport.height,
            fullWidth: background.width,
            fullHeight: background.height,
          });
        }
      } catch (err) {
        console.error(`Unable to update: ${JSON.stringify(err)}`);
      }
      break;
    }
    case "things": {
      // refactor update to handle things on their own
      await applyUpdate(state, evt.data.values, post);
      break;
    }
    case "resize": {
      state.view.canvas.width = evt.data.width;
      state.view.canvas.height = evt.data.height;
      const background = state.layers.background;
      if (background) {
        adjustZoomFromViewport(state.view);
        calculateViewport(state.view, background.width, background.height);
        trimPanning(state.view.image, background.width, background.height);
        fullRerender(state);
        post({
          cmd: "resized",
          width: state.view.viewport.width,
          height: state.view.viewport.height,
          fullWidth: background.width,
          fullHeight: background.height,
        });
      }
      break;
    }
    case "rotate": {
      /**
       * Set the angle then render all canvasses. Keep in mind we are using
       * UN-ROTATED images as our starting point and rotating to the request
       * angle. If you start trying to use the actual canvas data, which might
       * already be rotated, you end up over-rotating and things get really bad.
       */
      state.view.angle = evt.data.angle;
      fullRerender(state);
      break;
    }
    case "erase": {
      state.tools.pointer.startX = evt.data.x;
      state.tools.pointer.startY = evt.data.y;
      if (evt.data.buttons === 0) {
        // here we don't draw BUT if you look at animateBrush, you'll see that we'll just repaint the
        // overlay and then render the translucent brush
        if (!state.tools.recording) {
          const visible = state.layers.visible;
          if (!visible) break;
          visible.fillStyle = GUIDE_FILL;
          state.tools.recording = true;
          requestAnimationFrame(() => animateBrush(state));
        }
      } else if (evt.data.buttons === 1) {
        /* nop */
        state.tools.recording = false;
        eraseBrush(state, evt.data.x, evt.data.y, state.tools.brush);
      }
      break;
    }
    case "paint": {
      state.tools.pointer.startX = evt.data.x;
      state.tools.pointer.startY = evt.data.y;
      // here we do not turn recording on or off (thats handled by the move/record/end events elsewhere)
      // also "recording" is not "painting" TODO MICAH COME BACK HERE AND CONFIRM ITS ABOUT CANVAS ANIMATION
      // where we do not paint (painting is separate from drawing the selection or the translucent brush)
      if (evt.data.buttons === 0) {
        // here we don't draw BUT if you look at animateBrush, you'll see that we'll just repaint the
        // overlay and then render the translucent brush
        if (!state.tools.recording) {
          const visible = state.layers.visible;
          if (!visible) break;
          visible.fillStyle = GUIDE_FILL;
          state.tools.recording = true;
          requestAnimationFrame(() => animateBrush(state));
        }
      } else if (evt.data.buttons === 1) {
        // here however we just update the canvas with the actual brush. It seems that the fill call
        // in renderBrush will force the canvas to update so there isn't much point in using animation
        // frames
        if (state.tools.recording) {
          state.tools.recording = false;
          const fill = `rgba(${state.tools.colour.red}, ${state.tools.colour.green}, ${state.tools.colour.blue}, ${state.tools.renderOpacity})`;
          const visible = state.layers.visible;
          const full = state.layers.full;
          if (visible) visible.fillStyle = fill;
          if (full) full.fillStyle = fill;
        }
        renderBrush(state, evt.data.x, evt.data.y, state.tools.brush);
      }
      break;
    }
    case "token": {
      // tokens behave differently than brushes - brushes "record" the mouse movement when no button
      // is pressed and then paint directly to the canvases when it is. Tokens just record until the
      // the mouse button is pressed and then released. The token is then placed at the last mouse
      // position where by the end_token command.
      if (!state.tools.token) break;
      state.tools.token.token.x = evt.data.x;
      state.tools.token.token.y = evt.data.y;

      if (!state.tools.recording) {
        state.tools.recording = true;
        requestAnimationFrame(() => animateToken(state));
      }
      break;
    }
    case "set_token": {
      if (!("token" in evt.data)) break;
      state.tools.token = (await createDrawable(
        evt.data.token,
      )) as DrawableToken;
      break;
    }
    case "move_token": {
      if (!state.tools.recording) {
        state.tools.recording = true;
        requestAnimationFrame(() => animateAllTokens(state));
      }

      const { x, y } = evt.data;
      state.tools.pointer.startX = x;
      state.tools.pointer.startY = y;
      const p = unrotateScaleTranslatePoints(
        state.view,
        createPoints([x, y]),
      )[0];
      if (state.tools.token === undefined) {
        const idx = thingAt(
          state.things,
          p,
          DrawableToken,
          (thing) => thing.setOpacity(0.5),
          (thing) => thing.setOpacity(1),
        );
        if (idx < 0) break;
        if (evt.data.buttons === 1 && state.tools.token === undefined) {
          state.tools.token = state.things[idx] as DrawableToken;
          state.tools.token.token.x = p.x;
          state.tools.token.token.y = p.y;
        }
      } else if (evt.data.buttons === 1) {
        state.tools.token.token.x = p.x;
        state.tools.token.token.y = p.y;
      } else if (state.tools.token !== undefined) {
        state.tools.token.setOpacity(1);
        const t = state.tools.token.token;
        state.tools.recording = false;
        state.tools.token = undefined;
        post({ cmd: "token_moved", instance: t });
      }
      break;
    }
    case "delete_token": {
      if (!state.tools.recording) {
        state.tools.recording = true;
        requestAnimationFrame(() => animateAllTokens(state));
      }

      const { x, y } = evt.data;
      state.tools.pointer.startX = x;
      state.tools.pointer.startY = y;
      const p = unrotateScaleTranslatePoints(
        state.view,
        createPoints([x, y]),
      )[0];
      thingAt(
        state.things,
        p,
        DrawableToken,
        (thing) => thing.setOpacity(0.5),
        (thing) => thing.setOpacity(1),
      );
      break;
    }
    case "move":
    case "select":
    case "record": {
      state.tools.pointer.endX = evt.data.x;
      state.tools.pointer.endY = evt.data.y;
      if (!state.tools.recording) {
        state.tools.selecting = evt.data.cmd === "select";
        state.tools.panning = evt.data.cmd === "move";
        state.tools.recording =
          (state.tools.selecting && evt.data.buttons === 1) ||
          state.tools.panning;
        if (state.tools.recording) {
          state.tools.pointer.lastAnimX = evt.data.x;
          state.tools.pointer.lastAnimY = evt.data.y;
          state.tools.pointer.startX = evt.data.x;
          state.tools.pointer.startY = evt.data.y;
        }
        requestAnimationFrame(() => animateSelection(state));
      }
      break;
    }
    case "wait":
    case "end_move":
    case "end_panning": {
      state.tools.panning = false;
      state.tools.recording = false;
      resetPointer(state);
      // restore the clean (no opaque brush indicator/token indicator where the mouse was) overlay
      renderDisplay(state);
      break;
    }
    case "end_erase": {
      state.tools.recording = false;
      state.tools.panning = false;
      renderDisplay(state);
      void storeOverlay(state, post);
      break;
    }
    case "end_paint": {
      state.tools.recording = false;
      state.tools.panning = false;
      state.tools.brush = MIN_BRUSH;
      void storeOverlay(state, post);
      renderDisplay(state);
      break;
    }
    case "end_select": {
      if (state.tools.panning) {
        post({ cmd: "pan_complete" });
      } else {
        post({
          cmd: "select_complete",
          rect: rectFromPoints(
            createPoints([
              state.tools.pointer.startX,
              state.tools.pointer.startY,
              state.tools.pointer.endX,
              state.tools.pointer.endY,
            ]),
          ),
        });
      }
      // when we're done recording we're done panning BUT not selecting
      // we still have a selection on screen. Selection ends at the start
      // of the next mouse recording
      state.tools.recording = false;
      state.tools.panning = false;
      resetPointer(state);
      break;
    }
    case "end_token": {
      /**
       * end_token is triggered on "complete" from the statemachine which is triggered
       * by the mouse up event. startX and startY will be the last mouse position while
       * the mouse was down. This is the position where the token will be placed.
       */
      const token = state.tools.token;
      if (!token) {
        // TODO report this error to the main thread
        console.error(`ERROR: no token set in end_token`);
        return;
      }

      const p = unrotateScaleTranslatePoints(
        state.view,
        createPoints([token.token.x, token.token.y]),
      )[0];
      token.token.x = p.x;
      token.token.y = p.y;
      token.token.angle -= state.view.angle;
      token.normalize();

      // copy {... }is important otherwise, future mouse move impacts the drawable
      const t = await createDrawable({ ...token.token });

      state.tools.recording = false;
      state.tools.panning = false;
      renderToken(state.layers.things, token, state.view.zoom);
      state.things.push(t);
      post({ cmd: "token_placed", instance: token.token });

      token.token.angle += state.view.angle;
      token.normalize();
      break;
    }
    case "end_delete_token": {
      state.tools.recording = false;
      const p = unrotateScaleTranslatePoints(
        state.view,
        createPoints([state.tools.pointer.startX, state.tools.pointer.startY]),
      )[0];
      const idx = thingAt(state.things, p, DrawableToken);
      if (idx < 0) return;
      const t = state.things.splice(idx, 1)[0] as DrawableToken;
      post({ cmd: "token_deleted", instance: t.token });
      break;
    }
    case "obscure": {
      const fill = `rgba(${state.tools.colour.red}, ${state.tools.colour.green}, ${state.tools.colour.blue}, ${state.tools.renderOpacity})`;
      const r = evt.data.rect as unknown as Rect;
      renderBox(state, r.x, r.y, r.x + r.width, r.y + r.height, fill);
      void storeOverlay(state, post);
      break;
    }
    case "reveal": {
      const r = evt.data.rect as unknown as Rect;
      clearBox(state, r.x, r.y, r.x + r.width, r.y + r.height);
      void storeOverlay(state, post);
      break;
    }
    case "clear": {
      clearCanvas(state);
      void storeOverlay(state, post);
      break;
    }
    case "opacity": {
      state.tools.renderOpacity = evt.data.opacity;
      break;
    }
    case "display_opacity": {
      state.settings.displayOpacity = evt.data.opacity;
      renderDisplay(state);
      break;
    }
    case "colour": {
      state.tools.colour.red = evt.data.red;
      state.tools.colour.green = evt.data.green;
      state.tools.colour.blue = evt.data.blue;
      break;
    }
    case "zoom": {
      /**
       * TODO this shouldn't be called zoom -- instead we should have a generic
       * "get the un-rotated rectangle projected on the full sized image that has
       * been selected" call.  Maybe selection
       *
       * TODO call this "selection"
       */
      // get the scaled down viewport
      const fullVp = normalizeRect(
        rectFromPoints(
          unrotateScaleTranslatePoints(
            state.view,
            pointsFromRect(evt.data.rect),
          ),
        ),
      );

      // post back the full viewport
      post({ cmd: "viewport", viewport: fullVp });
      break;
    }
    case "zoom_in": {
      const { view } = state;
      const background = state.layers.background;
      if (!background) break;
      const current = view.zoom;
      let zoom = current ?? view.maxZoom;
      if (current !== undefined && current === view.maxZoom) {
        zoom = view.firstZoomStep;
      } else if (current !== undefined && current > ZOOM_STEP) {
        zoom = current - ZOOM_STEP;
      }
      if (zoom !== current) {
        adjustZoom(
          view,
          zoom,
          evt.data.x,
          evt.data.y,
          background.width,
          background.height,
        );
        renderAllCanvases(state);
      }
      break;
    }
    case "zoom_out": {
      const { view } = state;
      const background = state.layers.background;
      if (!background) break;
      const current = view.zoom;
      if (current === undefined || current === view.maxZoom) return;
      let zoom =
        current === view.firstZoomStep ? view.maxZoom : current + ZOOM_STEP;
      if (zoom >= view.maxZoom) zoom = view.maxZoom; // after a resize this can happen
      if (zoom !== current) {
        adjustZoom(
          view,
          zoom,
          evt.data.x,
          evt.data.y,
          background.width,
          background.height,
        );
        renderAllCanvases(state);
      }
      break;
    }
    case "brush_inc": {
      // eventually you will return to this - it may be a good idea to consider
      // creating separate events if its not too much overhead in the editor.
      //
      // this caused a https://github.com/micahg/tbltp/issues/319 because `vamp`
      // was undefined when calculateToken tried to access its properties.

      const token = state.tools.token;
      if (evt.data.action === "token" && token) {
        if (token.token.scale < 1) token.token.scale *= 2;
        else token.token.scale += 0.5;
      } else {
        state.tools.brush += MIN_BRUSH;
      }
      break;
    }
    case "brush_dec": {
      const token = state.tools.token;
      if (evt.data.action === "token" && token) {
        if (token.token.scale < 1) token.token.scale *= 0.5;
        else token.token.scale -= 0.5;
      } else {
        state.tools.brush -= state.tools.brush > MIN_BRUSH ? MIN_BRUSH : 0;
      }
      break;
    }
    case "brush_rot": {
      if (evt.data.action !== "token" || !state.tools.token) return;
      const coef = evt.data.delta > 0 ? 1 : -1;
      state.tools.token.token.angle += coef * 15;
      state.tools.token.normalize();
      console.log(`rotating token to ${state.tools.token.token.angle}`);
      break;
    }
    default: {
      console.error(`Unexpected worker command: ${evt.data.cmd}`);
      break;
    }
  }
}
