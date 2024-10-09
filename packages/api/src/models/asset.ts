import { Schema, model } from "mongoose";
import { Asset } from "@micahg/tbltp-common";

interface IAsset extends Asset {
  _id?: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  location?: string;
}

const AssetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true },
    location: { type: String },
  },
  { timestamps: true },
);
AssetSchema.index({ user: 1, name: 1 }, { unique: true });

const AssetModel = model<IAsset>("Asset", AssetSchema);

export { AssetModel, IAsset };
