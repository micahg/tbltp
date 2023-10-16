import { log } from "../utils/logger";
import { Schema, model } from 'mongoose';
import { Rect } from "../utils/tablestate";

/**
 * Student Interface.
 * 
 * Each student has a name, Organization ID, and links to a classroom.
 */
interface IScene {
  _id?: Schema.Types.ObjectId,
  user: Schema.Types.ObjectId;
  description: string;
  overlayContent?: string;
  userContent?: string;
  tableContent?: string;
  viewport?: Rect;
  backgroundSize?: Rect;
}

const SceneSchema = new Schema<IScene>({
  user:            { type: Schema.Types.ObjectId, required: true,  index: true },
  description:     { type: String,                required: true  },
  overlayContent:  { type: String,                required: false },
  userContent:     { type: String,                required: false },
  tableContent:    { type: String,                required: false },
  viewport:        { type: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
    required: false
  },
  backgroundSize:  { type: {
    x: Number,
    y: Number,
    width: Number,
    height: Number,
  },
  required: false
}
}, {timestamps: true});

const Scene = model<IScene>('Scene', SceneSchema);

export { Scene, IScene };