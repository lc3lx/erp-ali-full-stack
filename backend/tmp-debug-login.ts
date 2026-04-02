import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();
const users = await prisma.user.findMany({ select: { id: true, email: true, role: true, passwordHash: true } });
console.log('users_count=', users.length);
for (const u of users) {
  const ok = await bcrypt.compare('adminadmin123', u.passwordHash);
  console.log(u.email, 'role=', u.role, 'pwdMatch=', ok);
}
await prisma.$disconnect();
