// middleware/auth.js
import { AuthError, PermissionError } from "./errorHandler.js";
import prisma from "../utils/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "peninsula-super-secure-jwt-secret-2024";

// JWT Authentication
export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new AuthError("Authentication token required");
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
      throw new AuthError("Invalid token - user not found");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      next(new AuthError("Invalid token"));
    } else if (error.name === "TokenExpiredError") {
      next(new AuthError("Token expired"));
    } else {
      next(error);
    }
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
  canManageProducts: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageCustomers: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canManageOrders: (user) => ["ADMIN", "MANAGER", "STAFF"].includes(user.role),
  canDeleteRecords: (user) => ["ADMIN", "MANAGER"].includes(user.role),
  canViewAuditLogs: (user) => ["ADMIN"].includes(user.role),
  canManageUsers: (user) => ["ADMIN"].includes(user.role),
};
