import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import type { UserRole } from "@prisma/client";

const SALT_ROUNDS = 10;

export async function registerUser(email: string, password: string, role: UserRole = "USER") {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new AppError(409, "Email already registered");
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  return prisma.user.create({ data: { email: normalizedEmail, passwordHash, role } });
}

export async function login(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) throw new AppError(401, "Invalid credentials", "UNAUTHORIZED");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError(401, "Invalid credentials", "UNAUTHORIZED");
  const signOptions = { expiresIn: env.JWT_EXPIRES_IN } as SignOptions;
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    signOptions,
  );
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}
