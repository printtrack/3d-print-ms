import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const survey = await prisma.surveyResponse.findUnique({
    where: { token },
    include: {
      order: { select: { customerName: true, phase: { select: { name: true } } } },
    },
  });

  if (!survey) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const questionsRaw = await getSetting("survey_questions");
  let questions: string[] = [
    "Wie zufrieden waren Sie mit der Qualität?",
    "Wie würden Sie die Kommunikation bewerten?",
    "Würden Sie uns weiterempfehlen?",
  ];
  if (questionsRaw) {
    try {
      questions = JSON.parse(questionsRaw);
    } catch {
      // keep defaults
    }
  }

  return NextResponse.json({
    alreadySubmitted: survey.submittedAt !== null,
    customerName: survey.order.customerName,
    phaseName: survey.order.phase.name,
    questions,
    answers: survey.answers,
    comment: survey.comment,
  });
}

const submitSchema = z.object({
  answers: z.array(z.object({ question: z.string(), rating: z.number().int().min(1).max(5) })),
  comment: z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const survey = await prisma.surveyResponse.findUnique({
    where: { token },
    select: { id: true, orderId: true, submittedAt: true },
  });

  if (!survey) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (survey.submittedAt) {
    return NextResponse.json({ error: "Bereits ausgefüllt" }, { status: 409 });
  }

  try {
    const body = await req.json();
    const data = submitSchema.parse(body);

    await prisma.surveyResponse.update({
      where: { token },
      data: {
        answers: data.answers,
        comment: data.comment ?? null,
        submittedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        orderId: survey.orderId,
        userId: null,
        action: "SURVEY_SUBMITTED",
        details: "Kunde hat Umfrage ausgefüllt",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    console.error("Survey submit error:", err);
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
