import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { SurveyPageClient } from "./SurveyPageClient";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const survey = await prisma.surveyResponse.findUnique({
    where: { token },
    include: {
      order: { select: { customerName: true, phase: { select: { name: true } } } },
    },
  });

  if (!survey) notFound();

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

  const alreadySubmitted = survey.submittedAt !== null;
  const answers = survey.answers as Array<{ question: string; rating: number }> | null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {alreadySubmitted ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <div className="text-4xl">🙏</div>
              <h1 className="text-xl font-bold">Vielen Dank für Ihr Feedback!</h1>
              <p className="text-muted-foreground text-sm">
                Hallo {survey.order.customerName}, Ihre Antworten wurden bereits übermittelt.
              </p>
              {answers && answers.length > 0 && (
                <div className="mt-4 text-left space-y-2">
                  {answers.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <span className="text-muted-foreground">{a.question}</span>
                      <span className="font-medium">{"★".repeat(a.rating)}{"☆".repeat(5 - a.rating)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6 pb-6">
              <SurveyPageClient
                token={token}
                questions={questions}
                customerName={survey.order.customerName}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
