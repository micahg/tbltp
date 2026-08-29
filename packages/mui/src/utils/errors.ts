export function inferStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return;
  const status = (err as { status?: unknown }).status;
  if (typeof status === "number") return status;

  const error = (err as { error?: unknown }).error;
  const message = typeof error === "string" ? error : String(err);
  const code = message.match(/status\s+(\d{3})/i)?.[1];
  return code ? Number(code) : undefined;
}

type ErrorMessageMap = Partial<Record<number, string>>;

const WRITE_MESSAGES: ErrorMessageMap = {
  409: "Name already exists",
  413: "Asset too big",
  406: "Invalid asset format",
};

const DELETE_MESSAGES: ErrorMessageMap = {
  409: "Asset in use",
};

function messageForStatus(err: unknown, messages: ErrorMessageMap): string {
  const status = inferStatus(err);
  if (status !== undefined) {
    const message = messages[status];
    if (message) return message;
  }
  return "Unknown error happened";
}

export function errorMessageForCreateError(err: unknown): string {
  return messageForStatus(err, WRITE_MESSAGES);
}

export function errorMessageForUpdateError(err: unknown): string {
  return messageForStatus(err, WRITE_MESSAGES);
}

export function errorMessageForDeleteError(err: unknown): string {
  return messageForStatus(err, DELETE_MESSAGES);
}
