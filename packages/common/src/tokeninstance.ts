import { Token } from "./token";

export interface TokenInstance extends Omit<Token, "asset">{
    token: string;
    scene: string;
    x: number;
    y: number;
    scale: number;
  }