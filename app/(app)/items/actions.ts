"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const itemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  unit: z.string().trim().min(1),
  defaultUnitPrice: z.coerce.number().nonnegative(),
});

function parseItemForm(formData: FormData) {
  return itemSchema.safeParse({
    name: formData.get("name")?.toString() ?? "",
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
  redirect("/items");
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
  redirect("/items");
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

  await prisma.item.update({
    where: { id },
    data: { archived: !item.archived },
  });
  revalidatePath("/items");
  revalidatePath(`/items/${id}`);
  redirect(`/items/${id}`);
}
