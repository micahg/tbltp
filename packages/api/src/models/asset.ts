import { Schema, model, Types } from "mongoose";
import { Asset as BasicAsset } from "@micahg/tbltp-common";

export type Asset = Omit<BasicAsset, "_id" | "user"> & {
  asset?: Types.ObjectId;
};

interface IAsset extends Asset {
  _id?: Types.ObjectId;
  user: Types.ObjectId;
  /**
   * Bookkeeping for in-flight presigned uploads: the staging key the
   * client is currently uploading to and when it was issued. These are
   * database-only fields -- they never appear on the wire (the wire
   * contract is ASSET_FIELDS in the common package).
   */
  staging?: string;
  stagedAt?: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    user: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    tags: [{ type: String }],
    location: { type: String },
    revision: { type: Number, default: 0 },
    staging: { type: String },
    stagedAt: { type: Date },
  },
  { timestamps: true },
);
AssetSchema.index({ user: 1, name: 1 }, { unique: true });
AssetSchema.index({ user: 1, tags: 1 });

const AssetModel = model<IAsset>("Asset", AssetSchema);

export { AssetModel, IAsset };
