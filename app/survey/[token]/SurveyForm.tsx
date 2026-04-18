"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface SurveyFormProps {
  token: string;
  questions: string[];
  customerName: string;
  onSubmitted: () => void;
}

export function SurveyForm({ token, questions, customerName, onSubmitted }: SurveyFormProps) {
  const [ratings, setRatings] = useState<number[]>(questions.map(() => 0));
  const [hoveredRatings, setHoveredRatings] = useState<number[]>(questions.map(() => 0));
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function setRating(qIdx: number, value: number) {
    setRatings((prev) => {
      const next = [...prev];
      next[qIdx] = value;
      return next;
    });
  }

  function setHovered(qIdx: number, value: number) {
    setHoveredRatings((prev) => {
      const next = [...prev];
      next[qIdx] = value;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ratings.some((r) => r === 0)) {
      toast.error("Bitte bewerten Sie alle Fragen");
      return;
    }

    setSubmitting(true);
    try {
      const answers = questions.map((question, i) => ({ question, rating: ratings[i] }));
      const res = await fetch(`/api/survey/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Fehler beim Senden");
      }
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Senden");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Wie war Ihr Erlebnis?</h1>
        <p className="text-muted-foreground mt-1">Hallo {customerName}, wir freuen uns über Ihr Feedback.</p>
      </div>

      <div className="space-y-6">
        {questions.map((question, qIdx) => (
          <div key={qIdx} className="space-y-3">
            <Label className="text-sm font-medium">{question}</Label>
            <div
              className="flex gap-1"
              onMouseLeave={() => setHovered(qIdx, 0)}
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const active = (hoveredRatings[qIdx] || ratings[qIdx]) >= value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(qIdx, value)}
                    onMouseEnter={() => setHovered(qIdx, value)}
                    className="p-0.5 transition-transform hover:scale-110"
                    aria-label={`${value} von 5 Sternen`}
                  >
                    <Star
                      className={`h-8 w-8 transition-colors ${
                        active
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                );
              })}
              {ratings[qIdx] > 0 && (
                <span className="ml-2 self-center text-sm text-muted-foreground">
                  {ratings[qIdx]}/5
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="survey-comment">Weitere Anmerkungen (optional)</Label>
        <Textarea
          id="survey-comment"
          placeholder="Was hat Ihnen besonders gut gefallen? Was können wir verbessern?"
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
        />
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Wird gesendet..." : "Feedback absenden"}
      </Button>
    </form>
  );
}
