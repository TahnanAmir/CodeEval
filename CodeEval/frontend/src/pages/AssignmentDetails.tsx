import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Users, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { instructorApi, submissionApi } from "@/lib/api";

type AssignmentDetailsData = {
  id: number;
  title: string;
  description: string;
  language: string;
  dueDate: string | null;
  createdAt: string | null;
  instructorName: string;
  submissions: number;
  pending: number;
  avgGrade: number | null;
  hasPdf: boolean;
  rubric: null | {
    rubricId: number;
    correctness: number;
    style: number;
    efficiency: number;
    readability: number;
    total: number;
  };
};

const AssignmentDetails = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams();
  const { toast } = useToast();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = user?.role === "instructor" ? "instructor" : "student";

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [assignment, setAssignment] = useState<AssignmentDetailsData | null>(null);
  const [pdfToUpload, setPdfToUpload] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editingRubric, setEditingRubric] = useState(false);
  const [rubricDraft, setRubricDraft] = useState({
    correctness: 40,
    style: 25,
    efficiency: 15,
    readability: 20,
  });

  useEffect(() => {
    const loadDetails = async () => {
      if (!assignmentId) return;
      setLoading(true);
      try {
        const { data } = await submissionApi.getAssignmentById(assignmentId);
        setAssignment(data.assignment || null);
        const r = data.assignment?.rubric;
        if (r) {
          setRubricDraft({
            correctness: Number(r.correctness ?? 0),
            style: Number(r.style ?? 0),
            efficiency: Number(r.efficiency ?? 0),
            readability: Number(r.readability ?? 0),
          });
        }
      } catch (error: any) {
        toast({
          title: "Failed to load assignment",
          description: error?.response?.data?.message || "Please try again",
          variant: "destructive",
        });
        setAssignment(null);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [assignmentId, toast]);

  const handleViewPdf = async () => {
    if (!assignmentId) return;
    if (!assignment?.hasPdf) {
      toast({
        title: "PDF not available yet",
        description: "Your instructor hasn't attached the assignment PDF yet.",
        variant: "destructive",
      });
      return;
    }
    setDownloading(true);
    try {
      const response = await submissionApi.getAssignmentPdf(assignmentId);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (error: any) {
      toast({
        title: "PDF unavailable",
        description: error?.response?.data?.message || "Could not load assignment PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleUploadPdf = async () => {
    if (!assignmentId || !pdfToUpload) return;
    setUploadingPdf(true);
    try {
      await instructorApi.uploadAssignmentPdf(assignmentId, pdfToUpload);
      toast({ title: "PDF uploaded", description: "Assignment PDF has been attached successfully." });
      const { data } = await submissionApi.getAssignmentById(assignmentId);
      setAssignment(data.assignment || null);
      setPdfToUpload(null);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.response?.data?.error || error?.response?.data?.message || "Could not upload PDF",
        variant: "destructive",
      });
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSaveRubric = async () => {
    if (!assignmentId) return;
    setUploadingPdf(true);
    try {
      await instructorApi.updateRubric(assignmentId, {
        correctness_weight: rubricDraft.correctness,
        style_weight: rubricDraft.style,
        efficiency_weight: rubricDraft.efficiency,
        readability_weight: rubricDraft.readability,
      });
      toast({ title: "Rubric updated", description: "Rubric weights were saved successfully." });
      const { data } = await submissionApi.getAssignmentById(assignmentId);
      setAssignment(data.assignment || null);
      setEditingRubric(false);
    } catch (error: any) {
      toast({
        title: "Failed to update rubric",
        description: error?.response?.data?.error || error?.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} onLogout={handleLogout} />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <p className="text-muted-foreground">Loading assignment details...</p>
        </main>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation userRole={userRole} onLogout={handleLogout} />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <Button variant="ghost" onClick={() => navigate("/assignments")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
          <p className="text-destructive mt-6">Assignment not found.</p>
        </main>
      </div>
    );
  }

  const dueDateLabel = assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : "No deadline";

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole={userRole} onLogout={handleLogout} />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" className="mb-6" onClick={() => navigate("/assignments")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assignments
        </Button>

        <Card className="shadow-card mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">{assignment.title}</CardTitle>
                <CardDescription className="mt-2">{assignment.description || "No description provided."}</CardDescription>
              </div>
              <Badge variant="outline">{assignment.language}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Due: {dueDateLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Submissions: {assignment.submissions}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Pending reviews: {assignment.pending}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleViewPdf} disabled={downloading} variant={assignment.hasPdf ? "default" : "secondary"}>
                <FileText className="h-4 w-4 mr-2" />
                {downloading ? "Opening PDF..." : "View Assignment PDF"}
              </Button>
              <Button variant="outline" onClick={() => navigate(userRole === "student" ? "/dashboard/student" : "/dashboard/instructor")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Dashboard
              </Button>
            </div>
            {!assignment.hasPdf && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No PDF has been uploaded for this assignment yet.</p>
                {userRole === "instructor" && (
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setPdfToUpload(e.target.files?.[0] || null)}
                      className="block text-sm"
                    />
                    <Button onClick={handleUploadPdf} disabled={!pdfToUpload || uploadingPdf} variant="secondary">
                      {uploadingPdf ? "Uploading..." : "Upload PDF"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {assignment.rubric && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="font-medium">Rubric</p>
                    <p className="text-sm text-muted-foreground">Weights used for evaluation (total {assignment.rubric.total}).</p>
                  </div>
                  {userRole === "instructor" && (
                    <Button variant="outline" size="sm" onClick={() => setEditingRubric((v) => !v)}>
                      {editingRubric ? "Cancel" : "Edit Rubric"}
                    </Button>
                  )}
                </div>

                {editingRubric ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm">
                      <span className="text-muted-foreground">Correctness</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={rubricDraft.correctness}
                        onChange={(e) => setRubricDraft((p) => ({ ...p, correctness: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Style</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={rubricDraft.style}
                        onChange={(e) => setRubricDraft((p) => ({ ...p, style: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Efficiency</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={rubricDraft.efficiency}
                        onChange={(e) => setRubricDraft((p) => ({ ...p, efficiency: Number(e.target.value) }))}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Readability</span>
                      <input
                        type="number"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={rubricDraft.readability}
                        onChange={(e) => setRubricDraft((p) => ({ ...p, readability: Number(e.target.value) }))}
                      />
                    </label>
                    <div className="sm:col-span-2 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Total:{" "}
                        {rubricDraft.correctness + rubricDraft.style + rubricDraft.efficiency + rubricDraft.readability}
                      </p>
                      <Button onClick={handleSaveRubric} disabled={uploadingPdf} size="sm">
                        {uploadingPdf ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Correctness</p>
                      <p className="font-semibold">{assignment.rubric.correctness}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Style</p>
                      <p className="font-semibold">{assignment.rubric.style}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Efficiency</p>
                      <p className="font-semibold">{assignment.rubric.efficiency}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-muted-foreground">Readability</p>
                      <p className="font-semibold">{assignment.rubric.readability}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AssignmentDetails;
