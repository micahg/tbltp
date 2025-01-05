/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
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