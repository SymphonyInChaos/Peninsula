// middleware/auth.js
import { AuthError, PermissionError } from "./errorHandler.js";
import prisma from "../utils/db.js";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "peninsula-super-secure-jwt-secret-2024";

// JWT Authentication - UPDATED FIXED VERSION
export const authenticate = async (req, res, next) => {
  try {
    console.log("🔍 Auth middleware called for:", req.method, req.path);

    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      console.log("❌ No token provided");
      throw new AuthError("Authentication token required");
    }

    console.log("✅ Token found:", token.substring(0, 20) + "...");

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("✅ Token decoded:", decoded);

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
      console.log("❌ User not found for ID:", decoded.userId);
      throw new AuthError("Invalid token - user not found");
    }

    console.log("✅ User found:", user.email, "Role:", user.role);

    // FIX: Add roles array to user object (report.js expects req.user.roles[0])
    req.user = {
      ...user,
      roles: [user.role.toLowerCase()], // Convert to lowercase array
    };

    console.log("✅ req.user set:", {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      roles: req.user.roles,
    });

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error.message);

    if (error.name === "JsonWebTokenError") {
      next(new AuthError("Invalid token"));
    } else if (error.name === "TokenExpiredError") {
      next(new AuthError("Token expired"));
    } else {
      next(error);
    }
  }
};

// UPDATED: Make authorize case-insensitive
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError());
    }

    // Convert both user role and required roles to lowercase for comparison
    const userRoleLower = req.user.role.toLowerCase();
    const requiredRolesLower = roles.map((role) => role.toLowerCase());

    if (!requiredRolesLower.includes(userRoleLower)) {
      return next(
        new PermissionError(
          `Required roles: ${roles.join(", ")}. Your role: ${req.user.role}`
        )
      );
    }

    next();
  };
};

// UPDATED: Make permissions case-insensitive
export const permissions = {
  canManageProducts: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin", "manager"].includes(role);
  },
  canManageCustomers: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin", "manager"].includes(role);
  },
  canManageOrders: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin", "manager", "staff"].includes(role);
  },
  canDeleteRecords: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin", "manager"].includes(role);
  },
  canViewAuditLogs: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin"].includes(role);
  },
  canManageUsers: (user) => {
    const role = user?.role?.toLowerCase();
    return ["admin"].includes(role);
  },
};

// NEW: Debug utility to check user object
export const debugUser = (req) => {
  return {
    userExists: !!req.user,
    user: req.user,
    roles: req.user?.roles,
    rawHeaders: req.headers,
    token: req.header("Authorization")?.substring(0, 30) + "...",
  };
};
