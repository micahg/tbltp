import { Request, Response } from "express";

import { log } from "../utils/logger";
import { Rect, updateTableState } from '../utils/tablestate';
import { validateViewPort } from '../utils/viewport';


export function setViewPort(req: Request, res: Response, next: any) {
  let vp: Rect = req.body;
  if (!validateViewPort(vp)) {
    log.error(`Invalid height in set viewport body`);
    res.sendStatus(400);
  }
  updateTableState('viewport', vp);
  return res.json(vp);
}