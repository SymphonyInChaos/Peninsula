// middleware/auth.js
import { AuthError, PermissionError } from "./errorHandler.js";
import prisma from "../utils/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "peninsula-super-secure-jwt-secret-2024";

// JWT Authentication using HTTP-only cookies only
export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.auth_token;

    if (!token) {
      throw new AuthError("AUTHENTICATION_REQUIRED : 401");
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new AuthError("INVALID_AUTHENTICATION : 401");
    }

    req.user = user; // attach user to request
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(new AuthError("INVALID_AUTHENTICATION : 401"));
    } else if (error.name === "TokenExpiredError") {
      next(new AuthError("AUTHENTICATION_LIMIT_EXCEEDED : 403"));
    } else {
      next(error);
    }
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new AuthError());

    if (!roles.includes(req.user.role)) {
      return next(
        new PermissionError(
          `Required roles: ${roles.join(", ")}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

// Role-based permissions helper
export const permissions = {
  canManageProducts: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageCustomers: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageOrders: (user) => ["ADMIN", "MANAGER", "STAFF"].includes(user.role),
  canDeleteRecords: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canViewAuditLogs: (user) => ["ADMIN"].includes(user.role),
  canManageUsers: (user) => ["ADMIN"].includes(user.role),
};
