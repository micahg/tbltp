import { Asset, Token } from "@micahg/tbltp-common";
import { UpdateAssetDataRequest } from "../api/asset";
import { LoadProgress } from "../utils/content";

export interface CreateAssetAndTokenFlowArgs {
  asset: Asset;
  token: Token;
  file?: File;
  progress?: (evt: LoadProgress) => void;
}

export interface CreateAssetAndTokenFlowOps {
  updateAsset: (payload: Asset) => Promise<Asset>;
  updateAssetData: (payload: UpdateAssetDataRequest) => Promise<Asset>;
  updateToken: (payload: Token) => Promise<Token>;
  deleteAsset: (payload: Asset) => Promise<unknown>;
  onSuccess: () => void;
  onFailure: (message: string) => void;
}

function inferStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") return status;

  const error = (err as { error?: unknown }).error;
  const message = typeof error === "string" ? error : String(err);
  const code = message.match(/status\s+(\d{3})/i)?.[1];
  return code ? Number(code) : undefined;
}

function errorMessage(err: unknown): string {
  const status = inferStatus(err);
  if (status === 413) return "Asset too big";
  if (status === 406) return "Invalid asset format";
  if (status === 409) return "token name already exists";
  return "Unkown error happened";
}

export async function createAssetAndTokenFlow(
  args: CreateAssetAndTokenFlowArgs,
  ops: CreateAssetAndTokenFlowOps,
): Promise<Token> {
  let asset: Asset | undefined;

  if (!args.file) {
    const err = new Error("Create token flow requires an asset file");
    ops.onFailure(errorMessage(err));
    throw err;
  }

  try {
    asset = await ops.updateAsset(args.asset);
    if (!asset._id) {
      throw new Error("Created asset missing id");
    }

    await ops.updateAssetData({
      id: asset._id,
      file: args.file,
      progress: args.progress,
    });

    const token = await ops.updateToken({ ...args.token, asset: asset._id });
    ops.onSuccess();
    return token;
  } catch (err) {
    if (asset?._id) {
      try {
        await ops.deleteAsset(asset);
      } catch {
        // ignore cleanup errors so we still surface the original failure
      }
    }

    ops.onFailure(errorMessage(err));
    throw err;
  }
}
