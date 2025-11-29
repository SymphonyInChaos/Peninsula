import express from "express";
import bcrypt from "bcrypt";
import prisma from "../utils/db.js";
import jwt from "jsonwebtoken";
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    let {
      fname,
      lname,
      email,
      organization,
      username,
      password,
      city,
      country,
      timezone,
      phone,
      status
    } = req.body;

    // Required fields check
    if (!username || !password || !email || !fname || !lname || !organization || !city || !country) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Default timezone
    timezone = timezone || "UTC";

    // Default status
    status = "initial";

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already registered" });
    }

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long" });
    }
    if (!/\d/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one number" });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
    }
    if (!/[!@#$%^&*]/.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must contain at least one special character" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in DB
    const newUser = await prisma.user.create({
      data: {
        fname,
        lname,
        email,
        organization,
        username,
        passwordHash: passwordHash,
        city,
        country,
        timezone,
        phone,
        status
      }
    });

    res.status(200).json({
      message: "User registered successfully",
      user: newUser.email
    });
  } catch (e) {
    console.error("Registration failed", e);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Email and Password are required" });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    // 
    if(user.blocked){
      return res.status(403).json({ message: "Account is temporarily blocked , please try again after some hours " });
    }
    // 
    const MAX_ATTEMPTS = 5;
    const WINDOW_MINUTES = 15;

    if(user.updated_at){
      const diffMinutes = (Date.now() - new Date(user.updated_at).getTime()) / 60000;
      
      if (diffMinutes > WINDOW_MINUTES && user.pass_attempt > 0) {
        await prisma.user.update({
          where: { email },
          data: { pass_attempt: 0 }
        });
      }
    }

    // Validate password
    const isValid = await bcrypt.compare(password, user.passwordHash);
   if (!isValid) {
      const attempts = user.pass_attempt + 1;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          pass_attempt: attempts,
          blocked: attempts >= MAX_ATTEMPTS,
          updated_at: new Date()
        }
      });

      return res.status(400).json({ message: "Invalid credentials" });
    }
 // SUCCESSFUL LOGIN — reset attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        pass_attempt: 0,
        blocked: false,
        last_logged_in: new Date()
      }
    });
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Set token cookie
    res.cookie("_holdthedoor", token, {
      httpOnly: true,
      secure: false,       // Change to true in production (HTTPS)
      sameSite: "strict",
      maxAge: 3600000      // 1 hour (in ms)
    });

    return res.status(200).json({
      message: "Login Successful",
      user: {
        email: user.email,
        username: user.username,
        fname: user.fname,
        lname: user.lname
      }
    });

  } catch (e) {
    console.error("Login failed", e);
    res.status(500).json({ message: "Login failed" });
  }
});

export default router;
