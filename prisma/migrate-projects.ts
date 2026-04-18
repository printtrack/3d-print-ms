/**
 * One-time data migration: convert existing internal orders into first-class Project entities.
 *
 * Run with: npx tsx prisma/migrate-projects.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const internalOrders = await prisma.order.findMany({
    where: { isInternal: true, projectId: null },
    include: {
      assignees: true,
      milestones: true,
    },
  });

  console.log(`Found ${internalOrders.length} internal orders to migrate`);

  for (const order of internalOrders) {
    const defaultPhase = await prisma.projectPhase.findFirst({ where: { isDefault: true } });
    if (!defaultPhase) throw new Error("No default project phase found");

    const project = await prisma.project.create({
      data: {
        name: order.customerName,
        description: order.description || undefined,
        projectPhaseId: defaultPhase.id,
        deadline: order.deadline,
        createdAt: order.createdAt,
        assignees: {
          create: order.assignees.map((a) => ({ userId: a.userId })),
        },
      },
    });

    // Link order to project
    await prisma.order.update({
      where: { id: order.id },
      data: { projectId: project.id },
    });

    // Move milestones from order to project
    if (order.milestones.length > 0) {
      await prisma.milestone.updateMany({
        where: { orderId: order.id },
        data: { projectId: project.id, orderId: null },
      });
    }

    console.log(
      `  ✓ Created project "${project.name}" from order ${order.id} (${order.milestones.length} milestones migrated)`
    );
  }

  console.log("Migration complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
