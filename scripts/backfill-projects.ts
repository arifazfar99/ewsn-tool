// One-off backfill for the Project Hub feature (Project Resources/project-plan.md,
// 2026-09-13) - creates a Project for every existing Quotation that doesn't
// have one yet, so nothing is orphaned once /projects becomes the only real
// entry point. Data-mutation script: run manually, not through the app.
//   npx tsx scripts/backfill-projects.ts           (prints a plan, writes nothing)
//   npx tsx scripts/backfill-projects.ts --write    (actually creates/links)
import "dotenv/config";
import { prisma } from "../lib/db";

const write = process.argv.includes("--write");

async function main() {
  const orphaned = await prisma.quotation.findMany({
    where: { projectId: null },
    include: { client: true },
  });

  console.log(`Found ${orphaned.length} quotation(s) with no Project.`);
  if (!write) {
    for (const quotation of orphaned) {
      console.log(`  [dry run] ${quotation.number ?? "DRAFT"} (${quotation.client.name})`);
    }
    console.log("Dry run only - re-run with --write to apply.");
    return;
  }

  for (const quotation of orphaned) {
    // create+link as one transaction so a crash mid-run can't leave a
    // Project with no Quotation pointing at it - a re-run's
    // `where: { projectId: null }` above has no way to detect or reuse a
    // stray row like that.
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          title: quotation.client.name,
          clientId: quotation.clientId,
        },
      });
      await tx.quotation.update({
        where: { id: quotation.id },
        data: { projectId: created.id },
      });
      return created;
    });
    console.log(
      `  ${quotation.number ?? "DRAFT"} (${quotation.client.name}) -> Project ${project.id}`
    );
  }

  console.log("Backfill complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
