import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Download } from "lucide-react";
import { feedbackApi } from "@/lib/api";

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function toPdfSafeText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function wrapLine(line: string, maxChars = 95) {
  if (line.length <= maxChars) return [line];
  const wrapped: string[] = [];
  let remaining = line;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(" ", maxChars);
    if (splitAt <= 0) splitAt = maxChars;
    wrapped.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining.length > 0) wrapped.push(remaining);
  return wrapped;
}

function buildPdfBlob(rawText: string) {
  const normalizedText = toPdfSafeText(rawText || "No report content available.")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const rawLines = normalizedText.split("\n");
  const lines = rawLines.flatMap((line) => wrapLine(line));
  const linesPerPage = 48;
  const pagesContent: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pagesContent.push(lines.slice(i, i + linesPerPage));
  }
  if (!pagesContent.length) {
    pagesContent.push(["No report content available."]);
  }

  const pageCount = pagesContent.length;
  const pageObjectIds = Array.from({ length: pageCount }, (_, i) => 4 + i * 2);
  const contentObjectIds = Array.from({ length: pageCount }, (_, i) => 5 + i * 2);
  const fontObjectId = 4 + pageCount * 2;
  const objectCount = fontObjectId;

  const textEncoder = new TextEncoder();
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  pagesContent.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    const contentStream =
      "BT\n/F1 11 Tf\n50 770 Td\n14 TL\n" +
      pageLines.map((line) => `(${escapePdfText(line)}) Tj`).join("\nT*\n") +
      "\nET";

    objects[pageObjectId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    const contentLength = textEncoder.encode(contentStream).length;
    objects[contentObjectId] = `<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream`;
  });

  objects[fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  const chunks: string[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const pushChunk = (value: string) => {
    chunks.push(value);
    currentOffset += textEncoder.encode(value).length;
  };

  pushChunk("%PDF-1.4\n");
  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = currentOffset;
    pushChunk(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefStart = currentOffset;
  pushChunk(`xref\n0 ${objectCount + 1}\n`);
  pushChunk("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    pushChunk(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  pushChunk(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

const FeedbackReport = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const dashboardPath =
    role === "instructor" ? "/dashboard/instructor" : role === "admin" ? "/dashboard/admin" : "/dashboard/student";
  const navRole = role === "instructor" ? "instructor" : role === "admin" ? "admin" : "student";

  const handleLogout = () => {
    navigate("/");
  };

  const [feedback, setFeedback] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const handleDownloadReport = () => {
    const pdfBlob = buildPdfBlob(feedback?.reportText || "");
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "CodeEval Evaluation Report.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!submissionId) {
      setError("Missing submission id");
      setLoading(false);
      return;
    }

    let mounted = true;
    let timer: number | undefined;

    const load = async (isInitial = false) => {
      if (isInitial) setLoading(true);
      try {
        const { data } = await feedbackApi.getBySubmission(submissionId);
        if (!mounted) return;
        setFeedback(data);
        setError(null);

        const shouldPoll = data?.status === "pending";
        setPolling(shouldPoll);
        if (shouldPoll) {
          timer = window.setTimeout(() => load(false), 3000);
        }
      } catch (e) {
        if (!mounted) return;
        const errorMessage =
          (e as any)?.response?.data?.message || (e instanceof Error ? e.message : "Failed to load report");
        setError(errorMessage);
        setFeedback(null);
        setPolling(false);
      } finally {
        if (isInitial && mounted) setLoading(false);
      }
    };

    load(true);

    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [submissionId]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={navRole} onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" className="mb-6" onClick={() => navigate(dashboardPath)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">
                  {loading ? "Loading report..." : feedback?.assignment || "Report not found"}
                </CardTitle>
                <CardDescription>
                  {feedback?.submittedDate && feedback?.evaluationDate
                    ? `Submitted: ${feedback.submittedDate} • Evaluated: ${feedback.evaluationDate}`
                    : " "}
                </CardDescription>
              </div>
              <div className="text-right">
                {feedback?.status === "pending" && (
                  <p className="text-xs text-muted-foreground mt-2">Evaluation in progress{polling ? "..." : ""}</p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="outline">{feedback?.language || (loading ? "..." : "Code")}</Badge>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
                <span>Evaluated by AI</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={handleDownloadReport}
                disabled={feedback?.status !== "completed" || !feedback?.reportText}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Full Evaluation Report */}
        <Card className="shadow-card mb-6">
          <CardHeader>
            <CardTitle>Full Evaluation Report</CardTitle>
            <CardDescription>Complete output generated by the autograder engine.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <pre className="whitespace-pre-wrap break-words text-sm leading-6">
                {feedback?.reportText || "Evaluation has been queued. Please check again shortly."}
              </pre>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p className="text-sm text-destructive mt-6 text-center" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
};

export default FeedbackReport;
