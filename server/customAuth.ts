import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { authRateLimiter } from "./middleware/rateLimiter";
import { SALT_ROUNDS, SESSION_TTL_MS } from "./constants";
import { env } from "./config/env";
import { authLogger } from "./logger";

// Helper to sanitize user object (remove sensitive fields)
function sanitizeUser(user: any) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: SESSION_TTL_MS,
    tableName: "sessions",
  });
  return session({
    secret: env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS,
    },
  });
}

export async function setupCustomAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Passport Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Check if user has a password set (for users created via invitation)
          if (!user.passwordHash) {
            return done(null, false, { message: "Please set your password first" });
          }

          const isValidPassword = await bcrypt.compare(password, user.passwordHash);
          
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid email or password" });
          }

          // Update last login timestamp
          await storage.updateUser(user.id, {
            lastLoginAt: new Date(),
          });

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(null, false);
    }
  });

  // Login endpoint
  app.post("/api/auth/login", authRateLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        return res.json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  // Register endpoint
  app.post("/api/auth/register", authRateLimiter, async (req, res) => {
    try {
      const { email, password, firstName, lastName, token, accessKey } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      let validatedAccessKeyId: string | null = null;
      let invitationRecord: any = null;

      // Check for invitation token first (bypasses access key requirement)
      if (token) {
        invitationRecord = await storage.getInvitationByToken(token);
        if (!invitationRecord) {
          return res.status(400).json({ message: "Invalid invitation link" });
        }
        if (invitationRecord.status !== "pending") {
          return res.status(400).json({ message: "This invitation has already been used" });
        }
        if (new Date() > new Date(invitationRecord.expiresAt)) {
          await storage.updateInvitation(invitationRecord.id, { status: "expired" });
          return res.status(400).json({ message: "This invitation has expired" });
        }
        if (invitationRecord.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ message: "Email does not match invitation" });
        }
      } else {
        // No invitation token - require access key
        if (!accessKey) {
          return res.status(400).json({ message: "Access key is required for signup" });
        }

        // Normalize the access key (trim whitespace and uppercase)
        const normalizedAccessKey = accessKey.trim().toUpperCase();

        const accessKeyRecord = await storage.getAccessKeyByKey(normalizedAccessKey);

        if (!accessKeyRecord) {
          return res.status(404).json({ message: "Invalid access key" });
        }

        if (!accessKeyRecord.isActive) {
          return res.status(403).json({ message: "This access key has been revoked" });
        }

        if (accessKeyRecord.usedById) {
          return res.status(403).json({ message: "This access key has already been used" });
        }

        if (accessKeyRecord.expiresAt && new Date(accessKeyRecord.expiresAt) < new Date()) {
          return res.status(403).json({ message: "This access key has expired" });
        }

        validatedAccessKeyId = accessKeyRecord.id;
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.passwordHash) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Use company and role from invitation (already validated above)
      const companyId = invitationRecord?.companyId || null;
      const role = invitationRecord?.role || "tech";

      // Create or update user
      const userData = {
        id: existingUser?.id || randomUUID(),
        email,
        firstName,
        lastName,
        passwordHash,
        companyId,
        role: role as "admin" | "manager" | "tech",
      };

      const user = await storage.upsertUser(userData);

      // Mark access key as used (if it was validated)
      if (validatedAccessKeyId) {
        await storage.markAccessKeyUsed(validatedAccessKeyId, user.id);
      }

      // Mark invitation as accepted (if user registered via invitation)
      if (invitationRecord) {
        await storage.updateInvitation(invitationRecord.id, {
          status: "accepted",
        });
      }

      // Update company's used licenses if assigned to company
      if (companyId) {
        const companyUsers = await storage.getUsersByCompany(companyId);
        await storage.updateCompany(companyId, {
          usedLicenses: companyUsers.length,
        });
      }

      // Auto-login after registration
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        return res.json(sanitizeUser(user));
      });
    } catch (error) {
      authLogger.error({ err: error }, "Registration error");
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Set password endpoint (for users created via invitation)
  app.post("/api/auth/set-password", async (req, res) => {
    try {
      const { email, password, token, accessKey } = req.body;

      if (!email || !password || !token) {
        return res.status(400).json({ message: "Email, password, and token are required" });
      }

      // Validate access key (required for ALL user creation, including invitations)
      if (!accessKey) {
        return res.status(400).json({ message: "Access key is required" });
      }

      // Normalize the access key (trim whitespace and uppercase)
      const normalizedAccessKey = accessKey.trim().toUpperCase();

      const accessKeyRecord = await storage.getAccessKeyByKey(normalizedAccessKey);
      
      if (!accessKeyRecord) {
        return res.status(404).json({ message: "Invalid access key" });
      }

      if (!accessKeyRecord.isActive) {
        return res.status(403).json({ message: "This access key has been revoked" });
      }

      if (accessKeyRecord.usedById) {
        return res.status(403).json({ message: "This access key has already been used" });
      }

      if (accessKeyRecord.expiresAt && new Date(accessKeyRecord.expiresAt) < new Date()) {
        return res.status(403).json({ message: "This access key has expired" });
      }

      // Verify invitation token
      const invitation = await storage.getInvitationByToken(token);
      if (!invitation || invitation.email !== email) {
        return res.status(400).json({ message: "Invalid invitation token" });
      }

      if (invitation.status !== "pending") {
        return res.status(400).json({ message: "Invitation already used or expired" });
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        await storage.updateInvitation(invitation.id, { status: "expired" });
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create or update user
      const existingUser = await storage.getUserByEmail(email);
      const userData = {
        id: existingUser?.id || randomUUID(),
        email,
        passwordHash,
        companyId: invitation.companyId,
        role: invitation.role as "admin" | "manager" | "tech",
        firstName: existingUser?.firstName || email.split("@")[0],
        lastName: existingUser?.lastName || "",
      };

      const user = await storage.upsertUser(userData);

      // Mark access key as used
      await storage.markAccessKeyUsed(accessKeyRecord.id, user.id);

      // Mark invitation as accepted
      await storage.updateInvitation(invitation.id, {
        status: "accepted",
      });

      // Update company's used licenses
      const companyUsers = await storage.getUsersByCompany(invitation.companyId);
      await storage.updateCompany(invitation.companyId, {
        usedLicenses: companyUsers.length,
      });

      // Auto-login after setting password
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Password set but login failed" });
        }
        return res.json(sanitizeUser(user));
      });
    } catch (error) {
      authLogger.error({ err: error }, "Set password error");
      res.status(500).json({ message: "Failed to set password" });
    }
  });

  // Logout endpoint - supports both GET (for anchor links) and POST
  app.all("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        authLogger.error({ err }, "Logout error");
        return res.status(500).json({ message: "Logout failed" });
      }
      // Destroy the session completely
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          authLogger.error({ err: sessionErr }, "Session destroy error");
        }
        // Clear the session cookie
        res.clearCookie("connect.sid");
        // Redirect to login page for GET requests (anchor clicks)
        if (req.method === "GET") {
          return res.redirect("/auth");
        }
        res.json({ message: "Logged out successfully" });
      });
    });
  });

}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
