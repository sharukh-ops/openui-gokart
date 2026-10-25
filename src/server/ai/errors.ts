export type AiErrorCode = "not_configured" | "rate_limited" | "ai_failed" | "invalid_recipe";

/** A failure of the Ask flow that the API route turns into a clear HTTP error. */
export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    /** For invalid_recipe: what was still wrong with the model's last answer. */
    readonly problems: string[] = [],
    /** For rate_limited: seconds until Groq accepts requests again, when it says. */
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}
