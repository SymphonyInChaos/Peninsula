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
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError("Authentication required", 401));
    }

    // Check if user has any of the allowed roles
    // Handle both single role string and array of roles
    const userRoles = Array.isArray(req.user.roles) 
      ? req.user.roles 
      : [req.user.role || req.user.roles];
    
    // Convert to lowercase for comparison
    const normalizedUserRoles = userRoles.map(role => 
      typeof role === 'string' ? role.toLowerCase() : String(role).toLowerCase()
    );
    
    const normalizedAllowedRoles = allowedRoles.map(role => role.toLowerCase());
    
    const hasPermission = normalizedUserRoles.some(role => 
      normalizedAllowedRoles.includes(role)
    );
    
    if (!hasPermission) {
      return next(new AuthError("Insufficient permissions", 403));
    }
    
    console.log(`✅ Authorized: User has required role(s): ${allowedRoles.join(', ')}`);
    next();
  };
};

// UPDATED: Make permissions case-insensitive and handle roles array
export const permissions = {
  canManageProducts: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin", "manager"].includes(role));
  },
  
  canManageCustomers: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin", "manager"].includes(role));
  },
  
  canManageOrders: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin", "manager", "staff"].includes(role));
  },
  
  canDeleteRecords: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin", "manager"].includes(role));
  },
  
  canViewAuditLogs: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin"].includes(role));
  },
  
  canManageUsers: (user) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.some(role => ["admin"].includes(role));
  },
  
  hasRole: (user, requiredRole) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedRoles = userRoles.map(role => role.toLowerCase());
    return normalizedRoles.includes(requiredRole.toLowerCase());
  },
  
  hasAnyRole: (user, requiredRoles) => {
    if (!user) return false;
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.role || user.roles];
    const normalizedUserRoles = userRoles.map(role => role.toLowerCase());
    const normalizedRequiredRoles = requiredRoles.map(role => role.toLowerCase());
    return normalizedUserRoles.some(role => normalizedRequiredRoles.includes(role));
  },
};

// Role-based middleware shortcuts for common use cases
export const requireAdmin = authorize(["admin"]);
export const requireManager = authorize(["manager", "admin"]);
export const requireStaff = authorize(["staff", "manager", "admin"]);
export const requireAdminOrManager = authorize(["admin", "manager"]);

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

// Role validation helper
export const validateRole = (role) => {
  const validRoles = ["admin", "manager", "staff"];
  return validRoles.includes(role?.toLowerCase());
};

// Optional: Add this function if you want to extract user from request without middleware
export const getUserFromToken = async (token) => {
  try {
    if (!token) return null;
    
    const cleanToken = token.replace("Bearer ", "");
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
    
    if (!user) return null;
    
    return {
      ...user,
      roles: [user.role.toLowerCase()],
    };
  } catch (error) {
    console.error("Error getting user from token:", error.message);
    return null;
  }
};