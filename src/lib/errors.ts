export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NoActiveOrgError extends Error {
  readonly statusCode = 403;
  constructor(message = "No active organization membership") {
    super(message);
    this.name = "NoActiveOrgError";
  }
}

export class OrgInactiveError extends Error {
  readonly statusCode = 403;
  constructor(message = "Organization is not active") {
    super(message);
    this.name = "OrgInactiveError";
  }
}

export class PlanLimitError extends Error {
  readonly statusCode = 402;
  constructor(message = "Plan limit reached") {
    super(message);
    this.name = "PlanLimitError";
  }
}
