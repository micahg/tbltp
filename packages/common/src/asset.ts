/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
import { Token } from "./token";
import { Scene } from "./scene";

export interface Asset {
    _id?: string;
    user?: string;
    name: string;
    tags?: string[];
    location?: string;
    revision?: number;
}

export interface AssetUsage {
    tokens: Token[];
    scenes: Scene[];
}