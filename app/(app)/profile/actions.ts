"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

const profileSchema = z.object({
  logoDataUrl: z.string().optional(),
  name: z.string(),
  ssmNumber: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  bankDetailsText: z.string(),
});

export type ProfileFormState = { error?: string; success?: boolean };

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
    ssmNumber: formData.get("ssmNumber")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    phone: formData.get("phone")?.toString() ?? "",
    email: formData.get("email")?.toString() ?? "",
    bankDetailsText: formData.get("bankDetailsText")?.toString() ?? "",
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
  return { success: true };
}

const termsTemplateSchema = z.object({
  name: z.string().trim().min(1),
  text: z.string().trim().optional(),
});

function parseTermsTemplateForm(formData: FormData) {
  return termsTemplateSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    text: formData.get("text")?.toString() || undefined,
  });
}

export async function createTermsTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = parseTermsTemplateForm(formData);
  if (!parsed.success) {
    redirect("/profile?error=" + encodeURIComponent("Template name is required."));
  }

  await prisma.quotationTermsTemplate.create({
    data: { name: parsed.data.name, text: parsed.data.text ?? "" },
  });

  revalidatePath("/profile");
  redirect(withSuccess("/profile", "Template created"));
}

export async function updateTermsTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing template id");
  }

  const parsed = parseTermsTemplateForm(formData);
  if (!parsed.success) {
    redirect("/profile?error=" + encodeURIComponent("Template name is required."));
  }

  await prisma.quotationTermsTemplate.update({
    where: { id },
    data: { name: parsed.data.name, text: parsed.data.text ?? "" },
  });

  revalidatePath("/profile");
  redirect(withSuccess("/profile", "Template updated"));
}

export async function deleteTermsTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing template id");
  }

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.quotationTermsTemplate.delete({ where: { id } });
    if (deleted.isDefault) {
      const next = await tx.quotationTermsTemplate.findFirst({
        orderBy: { name: "asc" },
      });
      if (next) {
        await tx.quotationTermsTemplate.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
  });

  revalidatePath("/profile");
  redirect(withSuccess("/profile", "Template deleted"));
}

export async function setDefaultTermsTemplate(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing template id");
  }

  await prisma.$transaction([
    prisma.quotationTermsTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    }),
    prisma.quotationTermsTemplate.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);

  revalidatePath("/profile");
  redirect(withSuccess("/profile", "Default template updated"));
}
