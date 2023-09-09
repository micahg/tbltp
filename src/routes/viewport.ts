import { Request, Response } from "express";

import { log } from "../utils/logger";
import { Rect, updateTableState } from '../utils/tablestate';
import { validateViewPort } from '../utils/viewport';


export function setViewPort(req: Request, res: Response, next: any) {
  const vp: Rect = req.body.viewport;
  const bg: Rect = req.body.backgroundSize;
  if (vp && !validateViewPort(vp)) {
    log.error(`Invalid height in set viewport body`);
    res.sendStatus(400);
  }

  if (bg && !validateViewPort(bg)) {
    log.error(`Invalid background rect in set viewport body`);
    res.sendStatus(400);
  }
  if (vp) {
    updateTableState('viewport', vp);
  }
  if (bg) {
    updateTableState('background_size', bg);
  }
  return res.json(vp);
}