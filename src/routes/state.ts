import { Request, Response } from "express";
import { ASSETS_UPDATED_SIG } from "../utils/constants";
import { getTableState, TableState } from "../utils/tablestate";

export function updateState(req: Request, res: Response, next: any) {
  let state: TableState = getTableState();
  res.app.emit(ASSETS_UPDATED_SIG, state);
  return res.json(state);
}

export function getState(req: Request, res: Response, next: any) {
  return res.json(getTableState());
}