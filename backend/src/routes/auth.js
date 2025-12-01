// routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/db.js";
import { authenticate } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/errorHandler.js";

const router = Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "peninsula-super-secure-jwt-secret-2024";

// Check if any users exist
const hasUsers = async () => {
  const userCount = await prisma.user.count();
  return userCount > 0;
};

// Setup system with first admin user
router.post("/setup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    console.log("🔧 Setup request received:", { email, name });

    // Validate input
    if (!email || !password || !name) {
      throw new ValidationError("Email, password, and name are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("Please provide a valid email address");
    }

    // Validate password strength
    if (password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters long");
    }

    // Check if system already has users
    const systemHasUsers = await hasUsers();
    console.log("📊 System has users:", systemHasUsers);

    if (systemHasUsers) {
      throw new ValidationError(
        "System is already setup. Please use login instead."
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError("User already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create admin user (first user always becomes ADMIN)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "ADMIN", // First user is always admin
      },
    });

    console.log("✅ Admin user created:", user.email);

    // Generate token for the new user
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        isFirstUser: true,
      },
    });
  } catch (error) {
    console.error("❌ Setup error:", error);
    next(error);
  }
});

// OPEN REGISTRATION - No authentication required for first user
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name, role = "STAFF" } = req.body;

    console.log("📝 Registration request:", { email, name, role });

    // Validate input
    if (!email || !password || !name) {
      throw new ValidationError("Email, password, and name are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError("Please provide a valid email address");
    }

    // Validate password strength
    if (password.length < 6) {
      throw new ValidationError("Password must be at least 6 characters long");
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ValidationError("User already exists");
    }

    const systemHasUsers = await hasUsers();
    console.log("📊 System has users during registration:", systemHasUsers);

    // If no users exist, first user becomes ADMIN automatically
    // If users exist, use the provided role (default: STAFF)
    let userRole = role;

    if (!systemHasUsers) {
      // First user automatically becomes ADMIN regardless of what role they request
      userRole = "ADMIN";
      console.log("🎯 First user - automatically setting role to ADMIN");
    } else if (userRole === "ADMIN") {
      // For creating additional ADMIN users when system already has users, require authentication
      console.log("🔐 Checking admin permissions for creating admin user...");
      const token = req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        throw new AuthError("Authentication required to create admin users");
      }

      try {
        // Verify token and check if current user is admin
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { role: true },
        });

        if (!currentUser || currentUser.role !== "ADMIN") {
          throw new AuthError("Only admins can create admin users");
        }
        console.log("✅ Admin permission verified");
      } catch (tokenError) {
        throw new AuthError("Invalid or expired token");
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
      },
    });

    console.log("✅ User created:", user.email, "with role:", user.role);

    // Generate token for the new user
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      success: true,
      message: systemHasUsers
        ? "User created successfully"
        : "Admin account created successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
        isFirstUser: !systemHasUsers,
      },
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    next(error);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError("Email and password are required");
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AuthError("Invalid credentials");
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AuthError("Invalid credentials");
    }

    // Generate token
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get("/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
      },
    },
  });
});

// Check if system has users
router.get("/check-setup", async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    const hasUsers = userCount > 0;

    console.log(
      "🔍 Setup check - User count:",
      userCount,
      "Has users:",
      hasUsers
    );

    res.json({
      success: true,
      data: {
        hasUsers,
        userCount,
        needsSetup: !hasUsers,
      },
    });
  } catch (error) {
    console.error("❌ Setup check error:", error);
    res.json({
      success: true,
      data: {
        hasUsers: false,
        userCount: 0,
        needsSetup: true,
      },
    });
  }
});

// Change password
router.put("/change-password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ValidationError("Current and new password are required");
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new AuthError("Current password is incorrect");
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword },
    });

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
