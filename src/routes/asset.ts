import { Request, Response } from "express";

import { log } from "../utils/logger";

export function updateAsset(req: Request, res: Response, next: any) {
    log.info('MICAH update asset');
    if (!req.file) {
      res.sendStatus(406);
      return;
    }
    
    return res.sendStatus(204);
}