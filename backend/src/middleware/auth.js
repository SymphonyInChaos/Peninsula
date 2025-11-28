// middleware/auth.js
import { AuthError, PermissionError } from "./errorHandler.js";
import prisma from "../utils/db.js";

// Simple JWT-like auth (replace with real JWT in production)
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new AuthError();
    }

    // In production, verify JWT token here
    // For now, using simple user ID from token
    const user = await prisma.user.findUnique({
      where: { id: token },
    });

    if (!user) {
      throw new AuthError("Invalid token");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError());
    }

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

// Role-based permissions
export const permissions = {
  // Admin: full access
  // Manager: manage products and orders
  // Staff: create orders only

  canManageProducts: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageCustomers: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageOrders: (user) => ["ADMIN", "MANAGER", "STAFF"].includes(user.role),
  canDeleteRecords: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canViewAuditLogs: (user) => ["ADMIN"].includes(user.role),
};
