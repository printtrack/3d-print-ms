"use client";

import { useState } from "react";
import { SurveyForm } from "./SurveyForm";

interface SurveyPageClientProps {
  token: string;
  questions: string[];
  customerName: string;
}

export function SurveyPageClient({ token, questions, customerName }: SurveyPageClientProps) {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="text-center space-y-3 py-4">
        <div className="text-4xl">🙏</div>
        <h1 className="text-xl font-bold">Vielen Dank für Ihr Feedback!</h1>
        <p className="text-muted-foreground text-sm">
          Hallo {customerName}, Ihre Antworten wurden übermittelt.
        </p>
      </div>
    );
  }

  return (
    <SurveyForm
      token={token}
      questions={questions}
      customerName={customerName}
      onSubmitted={() => setSubmitted(true)}
    />
  );
}
