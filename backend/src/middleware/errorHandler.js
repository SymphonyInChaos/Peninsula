// middleware/errorHandler.js
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(errors) {
    super("Validation failed", 400, errors);
    this.name = "ValidationError";
  }
}

export class StockError extends AppError {
  constructor(message, productId, requested, available) {
    super(message, 400, { productId, requested, available });
    this.name = "StockError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
    this.name = "AuthError";
  }
}

export class PermissionError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, 403);
    this.name = "PermissionError";
  }
}

export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details || null;

  // Handle different error types
  if (err.name === "ZodError") {
    statusCode = 400;
    message = "Validation failed";
    details = err.errors.map((error) => ({
      field: error.path.join("."),
      message: error.message,
    }));
  }

  if (err.code === "P2002") {
    statusCode = 409;
    message = "Duplicate entry found";
    const field = err.meta?.target?.[0];
    details = field ? `A record with this ${field} already exists` : null;
  }

  if (err.code === "P2025") {
    statusCode = 404;
    message = "Record not found";
  }

  // Response structure
  const response = {
    success: false,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};
