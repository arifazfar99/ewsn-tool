"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const clientSchema = z.object({
  name: z.string().trim().min(1),
  address: z.string().trim().min(1),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    address: formData.get("address")?.toString() ?? "",
    contactPerson: formData.get("contactPerson")?.toString() || undefined,
    phone: formData.get("phone")?.toString() || undefined,
    email: formData.get("email")?.toString() || undefined,
  });
}

export async function createClient(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    redirect(
      "/clients/new?error=" +
        encodeURIComponent("Name and address are required.")
    );
  }

  await prisma.client.create({ data: parsed.data });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing client id");
  }

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    redirect(
      `/clients/${id}?error=` +
        encodeURIComponent("Name and address are required.")
    );
  }

  await prisma.client.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect("/clients");
}

export async function deleteClient(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing client id");
  }

  try {
    await prisma.client.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2003"
    ) {
      redirect(
        `/clients/${id}?error=` +
          encodeURIComponent("Can't delete a client with existing documents.")
      );
    }
    throw err;
  }

  revalidatePath("/clients");
  redirect("/clients");
}
