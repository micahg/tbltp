import { Schema, model } from 'mongoose';

/**
 * TableTop Interface.
 * 
 * Each TableTop has a sub (subject) from their JWT.
 */
interface ITableTop {
  _id?: Schema.Types.ObjectId,
  user: Schema.Types.ObjectId;
  scene?: Schema.Types.ObjectId;
}

const TableTopSchema = new Schema<ITableTop>({
    user:  { type: Schema.Types.ObjectId, required: true,  index: true },
    scene: { type: Schema.Types.ObjectId, required: false, index: false },
}, {timestamps: true});

const TableTop = model<ITableTop>('TableTop', TableTopSchema);

export { TableTop, ITableTop };