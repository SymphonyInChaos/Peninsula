// routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/db.js";
import { authenticate } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/errorHandler.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = "7d";

// Cookie options
const cookieOptions = {
  httpOnly: true,          // ❗ JavaScript cannot access cookie
  secure: true,            // ❗ Only HTTPS
  sameSite: "strict",      // ❗ Prevent CSRF
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

// Check if users exist
const hasUsers = async () => {
  return (await prisma.user.count()) > 0;
};

// Helper: issue cookie token
const sendToken = (res, user) => {
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.cookie("_holdTheDoor_", token, cookieOptions);
};

// -----------------------------
// FIRST SETUP (first admin)
// -----------------------------
// router.post("/setup", async (req, res, next) => {
//   try {
//     const { email, password, name } = req.body;

//     if (!email || !password || !name)
//       throw new ValidationError("Email, password, and name are required");

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email))
//       throw new ValidationError("Invalid email format");

//     if (password.length < 6)
//       throw new ValidationError("Password must be ≥ 6 characters");

//     if (await hasUsers())
//       throw new ValidationError("System already initialized — please login");

//     const existing = await prisma.user.findUnique({ where: { email } });
//     if (existing) throw new ValidationError("User already exists");

//     const hashedPassword = await bcrypt.hash(password, 12);

//     const user = await prisma.user.create({
//       data: {
//         email,
//         password: hashedPassword,
//         name,
//         role: "ADMIN",
//       },
//     });


//     res.status(201).json({
//       success: true,
//       message: "Admin created successfully",
//       data: {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         role: user.role,
//         isFirstUser: true,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// });

// -----------------------------
// REGISTER USER
// -----------------------------
// router.post("/register", async (req, res, next) => {
//   try {
//     const { email, password, name, role = "STAFF" } = req.body;

//     if (!email || !password || !name)
//       throw new ValidationError("Email, password, and name are required");

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email))
//       throw new ValidationError("Invalid email");

//     if (password.length < 6)
//       throw new ValidationError("Password must be ≥ 6 characters");

//     const exists = await prisma.user.findUnique({ where: { email } });
//     if (exists) throw new ValidationError("User already exists");

//     const systemHasUsers = await hasUsers();
//     let userRole = role;

//     // First user always admin
//     if (!systemHasUsers) {
//       userRole = "ADMIN";
//     }

//     // Only admins can create admins (after initialization)
//     if (systemHasUsers && userRole === "ADMIN") {
//       const token = req.cookies.auth_token;

//       if (!token) throw new AuthError("Admin authentication required");
//       const decoded = jwt.verify(token, JWT_SECRET);

//       const adminUser = await prisma.user.findUnique({
//         where: { id: decoded.userId },
//         select: { role: true },
//       });

//       if (!adminUser || adminUser.role !== "ADMIN")
//         throw new AuthError("Only admins can create admin users");
//     }

//     const hashedPassword = await bcrypt.hash(password, 12);

//     const user = await prisma.user.create({
//       data: { email, password: hashedPassword, name, role: userRole },
//     });


//     res.status(201).json({
//       success: true,
//       message: "User created successfully",
//       data: {
//         id: user.id,
//         email: user.email,
//         name: user.name,
//         role: user.role,
//         isFirstUser: !systemHasUsers,
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// });

// -----------------------------
// LOGIN
// -----------------------------
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      throw new ValidationError("Email and password required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AuthError("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new AuthError("Invalid credentials");

    sendToken(res, user);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// GET CURRENT USER
// -----------------------------
router.get("/me", authenticate, async (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    },
  });
});

// -----------------------------
// LOGOUT
// -----------------------------
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.json({ success: true, message: "Logged out" });
});

export default router;
