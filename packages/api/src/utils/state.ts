import { checkSchema } from "express-validator";

export function stateValidator() {
  return checkSchema({
    scene: {
      in: ["body"],
      optional: false,
      isMongoId: {
        errorMessage: "Invalid scene ID",
      },
    },
  });
}
