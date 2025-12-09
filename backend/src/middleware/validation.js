// src/middleware/validation.js
import { AppError } from "./errorHandler.js";

/**
 * Middleware to validate report query parameters
 * @param {string[]} requiredParams - Array of required parameter names
 * @returns {Function} Express middleware function
 */
export const validateReportParams = (requiredParams = []) => {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validate required parameters
      requiredParams.forEach((param) => {
        if (req.query[param] && !isValidParam(param, req.query[param])) {
          errors.push(`Invalid ${param} format`);
        }
      });

      // Validate date parameters if present
      if (req.query.startDate && !isValidDate(req.query.startDate)) {
        errors.push("Invalid startDate format. Use YYYY-MM-DD");
      }

      if (req.query.endDate && !isValidDate(req.query.endDate)) {
        errors.push("Invalid endDate format. Use YYYY-MM-DD");
      }

      // Validate date range if both dates are present
      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(req.query.endDate);

        if (start > end) {
          errors.push("startDate cannot be after endDate");
        }

        // Validate date range is reasonable (max 365 days)
        const diffInDays = Math.abs((end - start) / (1000 * 60 * 60 * 24));
        if (diffInDays > 365) {
          errors.push("Date range cannot exceed 365 days");
        }
      }

      // Validate threshold parameter if present
      if (req.query.threshold) {
        const threshold = parseInt(req.query.threshold);
        if (isNaN(threshold) || threshold < 0 || threshold > 1000) {
          errors.push("Threshold must be a number between 0 and 1000");
        }
      }

      // Validate limit parameter if present
      if (req.query.limit) {
        const limit = parseInt(req.query.limit);
        if (isNaN(limit) || limit < 1 || limit > 1000) {
          errors.push("Limit must be a number between 1 and 1000");
        }
      }

      // Validate period parameter if present
      if (
        req.query.period &&
        !["daily", "weekly", "monthly"].includes(req.query.period)
      ) {
        errors.push("Period must be 'daily', 'weekly', or 'monthly'");
      }

      // Validate weeks parameter if present
      if (req.query.weeks) {
        const weeks = parseInt(req.query.weeks);
        if (isNaN(weeks) || weeks < 1 || weeks > 104) {
          errors.push("Weeks must be a number between 1 and 104");
        }
      }

      if (errors.length > 0) {
        throw new AppError(`Validation failed: ${errors.join(", ")}`, 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate date parameter
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidDate(dateStr) {
  if (!dateStr) return true;

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return date instanceof Date && !isNaN(date);
}

/**
 * Validate specific parameter types
 * @param {string} paramName - Parameter name
 * @param {any} value - Parameter value
 * @returns {boolean} True if valid
 */
function isValidParam(paramName, value) {
  switch (paramName) {
    case "date":
      return isValidDate(value);
    case "startDate":
    case "endDate":
      return isValidDate(value);
    case "threshold":
      const threshold = parseInt(value);
      return !isNaN(threshold) && threshold >= 0 && threshold <= 1000;
    case "limit":
      const limit = parseInt(value);
      return !isNaN(limit) && limit >= 1 && limit <= 1000;
    case "weeks":
      const weeks = parseInt(value);
      return !isNaN(weeks) && weeks >= 1 && weeks <= 104;
    case "period":
      return ["daily", "weekly", "monthly"].includes(value);
    default:
      return true;
  }
}

/**
 * Middleware to validate customer ID parameter
 * @returns {Function} Express middleware function
 */
export const validateCustomerId = () => {
  return (req, res, next) => {
    try {
      const { customerId } = req.query;

      if (customerId && !isValidCustomerId(customerId)) {
        throw new AppError("Invalid customer ID format", 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate customer ID format (UUID or numeric)
 * @param {string} customerId - Customer ID to validate
 * @returns {boolean} True if valid
 */
function isValidCustomerId(customerId) {
  if (!customerId) return true;

  // UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Numeric ID format
  const numericRegex = /^\d+$/;

  return uuidRegex.test(customerId) || numericRegex.test(customerId);
}

/**
 * Middleware to validate report export parameters
 * @returns {Function} Express middleware function
 */
export const validateExportParams = () => {
  return (req, res, next) => {
    try {
      const { type, format } = req.params;
      const errors = [];

      // Validate report type
      const validTypes = [
        "daily-sales",
        "payment-analytics",
        "channel-performance",
        "inventory",
        "customers",
        "sales-trend",
        "inventory-valuation",
      ];

      if (!validTypes.includes(type)) {
        errors.push(
          `Invalid report type. Valid types: ${validTypes.join(", ")}`
        );
      }

      // Validate export format
      const validFormats = ["json", "csv", "excel", "pdf"];
      if (format && !validFormats.includes(format)) {
        errors.push(
          `Invalid format. Valid formats: ${validFormats.join(", ")}`
        );
      }

      if (errors.length > 0) {
        throw new AppError(
          `Export validation failed: ${errors.join(", ")}`,
          400
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to validate date range parameters
 * @param {Object} options - Validation options
 * @param {number} options.maxDays - Maximum allowed days in range
 * @returns {Function} Express middleware function
 */
export const validateDateRange = (options = {}) => {
  const { maxDays = 365 } = options;

  return (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return next(); // Skip validation if dates not provided
      }

      const errors = [];

      // Validate date formats
      if (!isValidDate(startDate)) {
        errors.push("Invalid startDate format. Use YYYY-MM-DD");
      }

      if (!isValidDate(endDate)) {
        errors.push("Invalid endDate format. Use YYYY-MM-DD");
      }

      if (errors.length > 0) {
        throw new AppError(`Date validation failed: ${errors.join(", ")}`, 400);
      }

      // Validate date range
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        throw new AppError("startDate cannot be after endDate", 400);
      }

      const diffInDays = Math.abs((end - start) / (1000 * 60 * 60 * 24));
      if (diffInDays > maxDays) {
        throw new AppError(`Date range cannot exceed ${maxDays} days`, 400);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to validate numeric parameters
 * @param {string[]} paramNames - Array of parameter names to validate as numbers
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @returns {Function} Express middleware function
 */
export const validateNumericParams = (paramNames, options = {}) => {
  const { min = 0, max = 10000 } = options;

  return (req, res, next) => {
    try {
      const errors = [];

      paramNames.forEach((paramName) => {
        const value = req.query[paramName];

        if (value !== undefined && value !== null && value !== "") {
          const numValue = parseInt(value);

          if (isNaN(numValue)) {
            errors.push(`${paramName} must be a valid number`);
          } else if (numValue < min) {
            errors.push(`${paramName} must be at least ${min}`);
          } else if (numValue > max) {
            errors.push(`${paramName} cannot exceed ${max}`);
          }
        }
      });

      if (errors.length > 0) {
        throw new AppError(
          `Numeric validation failed: ${errors.join(", ")}`,
          400
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Utility function to sanitize report parameters
 * @param {Object} params - Query parameters
 * @returns {Object} Sanitized parameters
 */
export const sanitizeReportParams = (params) => {
  const sanitized = { ...params };

  // Convert strings to numbers where applicable
  if (sanitized.threshold) {
    sanitized.threshold = parseInt(sanitized.threshold) || 10;
  }

  if (sanitized.limit) {
    sanitized.limit = parseInt(sanitized.limit) || 50;
  }

  if (sanitized.weeks) {
    sanitized.weeks = parseInt(sanitized.weeks) || 8;
  }

  // Ensure period is valid
  if (
    sanitized.period &&
    !["daily", "weekly", "monthly"].includes(sanitized.period)
  ) {
    sanitized.period = "weekly";
  }

  // Trim string values
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "string") {
      sanitized[key] = sanitized[key].trim();
    }
  });

  return sanitized;
};
