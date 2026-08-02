import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_EMAIL and SEED_PASSWORD must be set in .env");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  await prisma.businessProfile.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
