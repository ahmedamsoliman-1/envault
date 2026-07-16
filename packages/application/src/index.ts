export interface RequestContext {
  requestId: string;
  actorId: string;
  vaultId: string;
}

export abstract class ApplicationError extends Error {
  public abstract readonly code: string;

  protected constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthenticatedError extends ApplicationError {
  public readonly code = "UNAUTHENTICATED";
}

export class ForbiddenError extends ApplicationError {
  public readonly code = "FORBIDDEN";
}

export class EmailNotVerifiedError extends ApplicationError {
  public readonly code = "EMAIL_NOT_VERIFIED";
}
