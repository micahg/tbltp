import { Token } from "./token";

/**
 * Token placement properties without knowing the scene details
 */
export interface ScenelessTokenInstance extends Omit<Token, "asset"> {
  token: string;
  x: number;
  y: number;
  scale: number;
}

export interface TokenInstance extends ScenelessTokenInstance{
  scene: string;
}