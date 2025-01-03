import { Asset } from "./asset";

export const MAX_HP = 9999;
export const MIN_HP = 1;
export interface Token {
  _id?: string;
  name: string;
  visible: boolean;
  asset?: string;
  hitPoints?: number;
}

export interface HydratedToken extends Omit<Token, "asset"> {
  asset?: Asset;
}