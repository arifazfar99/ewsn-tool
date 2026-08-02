"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  logoDataUrl: z.string().optional(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  bankDetailsText: z.string(),
  quotationTerms: z.string(),
});

export type ProfileFormState = { error?: string };

export async function updateProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = profileSchema.safeParse({
    logoDataUrl: formData.get("logoDataUrl")?.toString() || undefined,
    name: formData.get("name")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    bankDetailsText: formData.get("bankDetailsText")?.toString() ?? "",
    quotationTerms: formData.get("quotationTerms")?.toString() ?? "",
  });

  if (!parsed.success) {
    return { error: "Please check the form fields." };
  }

  const { logoDataUrl, ...rest } = parsed.data;

  await prisma.businessProfile.upsert({
    where: { id: "singleton" },
    update: { ...rest, ...(logoDataUrl ? { logoDataUrl } : {}) },
    create: { id: "singleton", logoDataUrl, ...rest },
  });

  revalidatePath("/profile");
  return {};
}
