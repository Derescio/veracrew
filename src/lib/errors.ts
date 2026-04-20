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

// Fix #16: carry status + organizationId so callers can route to correct recovery UI
export class OrgInactiveError extends Error {
  readonly statusCode = 403;
  readonly orgStatus: string;
  readonly organizationId: string;

  constructor({
    status,
    organizationId,
    message = "Organization is not active",
  }: {
    status: string;
    organizationId: string;
    message?: string;
  }) {
    super(message);
    this.name = "OrgInactiveError";
    this.orgStatus = status;
    this.organizationId = organizationId;
  }
}

export class PlanLimitError extends Error {
  readonly statusCode = 402;
  constructor(message = "Plan limit reached") {
    super(message);
    this.name = "PlanLimitError";
  }
}
