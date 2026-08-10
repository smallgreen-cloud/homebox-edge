export class PublicHttpError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 413,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidRequestError extends PublicHttpError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends PublicHttpError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends PublicHttpError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class PayloadTooLargeError extends PublicHttpError {
  constructor(message: string) {
    super(message, 413);
  }
}
