"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const itemSchema = z.object({
  name: z.string().trim().min(1),
  nameMs: z.string().trim().optional(),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  defaultUnitPrice: z.coerce.number().nonnegative(),
});

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
    nameMs: formData.get("nameMs")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    unit: formData.get("unit")?.toString() ?? "",
    defaultUnitPrice: formData.get("defaultUnitPrice")?.toString() ?? "",
  });
}

export async function createItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    redirect(
      "/items/new?error=" +
        encodeURIComponent(
          "Name, unit and a valid default unit price are required."
        )
    );
  }

  await prisma.item.create({ data: parsed.data });
  revalidatePath("/items");
  redirect(withSuccess("/items", "Item created"));
}

export async function updateItem(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing item id");
  }

  const parsed = parseItemForm(formData);
  if (!parsed.success) {
    redirect(
      `/items/${id}?error=` +
        encodeURIComponent(
          "Name, unit and a valid default unit price are required."
        )
    );
  }

  await prisma.item.update({ where: { id }, data: parsed.data });
  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  redirect(withSuccess("/items", "Item updated"));
}

export async function toggleItemArchived(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing item id");
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { archived: true },
  });
  if (!item) {
    throw new Error("Item not found");
  }

  const archived = !item.archived;
  await prisma.item.update({
    where: { id },
    data: { archived },
  });
  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  redirect(
    withSuccess(`/items/${id}`, archived ? "Item archived" : "Item unarchived")
  );
}
