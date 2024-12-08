export const MAX_HP = 9999;
export const MIN_HP = 1;
export interface Token {
  name: string;
  visible: boolean;
  asset?: string;
  hitPoints?: number;
}