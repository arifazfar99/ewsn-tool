"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

function withSuccess(path: string, message: string) {
  return `${path}?success=${encodeURIComponent(message)}`;
}

const createProjectSchema = z.object({
  clientId: z.string().trim().min(1),
  title: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function createProject(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = createProjectSchema.safeParse({
    clientId: formData.get("clientId")?.toString() ?? "",
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  });
  if (!parsed.success) {
    redirect(
      "/projects/new?error=" + encodeURIComponent("A client is required.")
    );
  }

  const { clientId, title, notes } = parsed.data;

  const project = await prisma.project.create({
    data: { clientId, title: title || null, notes: notes || null },
  });

  revalidatePath("/projects");
  redirect(withSuccess(`/projects/${project.id}`, "Project created"));
}

const notesSchema = z.object({
  title: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// Never locked - a Project's own content (unlike every document it wraps)
// has no issuance step to freeze it.
export async function saveProjectNotes(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Missing project id");
  }

  const parsed = notesSchema.safeParse({
    title: formData.get("title")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  });
  if (!parsed.success) {
    redirect(`/projects/${id}?error=` + encodeURIComponent("Could not save notes."));
  }

  const { title, notes } = parsed.data;

  await prisma.project.update({
    where: { id },
    data: { title: title || null, notes: notes || null },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(withSuccess(`/projects/${id}`, "Notes saved"));
}
