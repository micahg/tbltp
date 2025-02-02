import { HydratedToken, HydratedTokenInstance } from "@micahg/tbltp-common";

export function fromHydratedToken(d: HydratedToken): HydratedTokenInstance {
  return {
    name: d.name,
    visible: false,
    token: d._id!,
    asset: d.asset?.location || "",
    scene: "",
    x: 0,
    y: 0,
    scale: 1,
    angle: 0,
  };
}
