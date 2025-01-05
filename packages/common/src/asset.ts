/**
 * IMPORTANT: Do not change the interfaces in this file without also reviewing the corresponding
 * mongoose models and (if applicable) omitting/redefining the types.
 */
export interface Asset {
    _id?: string;
    user?: string;
    name: string;
    location?: string;
    revision?: number;
}