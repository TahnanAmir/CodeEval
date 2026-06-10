import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, FileText, BarChart3, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { authApi, evaluationApi } from "@/lib/api";

const InstructorDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [avgClassGrade, setAvgClassGrade] = useState<number | null>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [assignments, setAssignments] = useState<Array<{ id: number; title: string; submissions: number; pending: number; avgGrade: number | null }>>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Array<{ id: string; student: string; assignment: string; grade: number | null; status: string }>>([]);
  const [grades, setGrades] = useState<Array<{ studentId: string; studentName: string; submissionId: string; status: string; hasReport: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringSubmissionId, setTriggeringSubmissionId] = useState<string | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [batchEvaluating, setBatchEvaluating] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const instructorId = user?.user_id;

  const selectedAssignmentId = useMemo(() => {
    const n = Number(selectedAssignment);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [selectedAssignment]);

  const pendingGradeRows = useMemo(
    () => grades.filter((g) => !g.hasReport && g.status !== "completed"),
    [grades],
  );

  const allPendingSelected =
    pendingGradeRows.length > 0 &&
    pendingGradeRows.every((g) => selectedSubmissionIds.includes(g.submissionId));

  const somePendingSelected = pendingGradeRows.some((g) =>
    selectedSubmissionIds.includes(g.submissionId),
  );

  const headerCheckboxState: boolean | "indeterminate" =
    pendingGradeRows.length === 0
      ? false
      : allPendingSelected
        ? true
        : somePendingSelected
          ? "indeterminate"
          : false;

  useEffect(() => {
    setSelectedSubmissionIds([]);
  }, [selectedAssignmentId]);

  useEffect(() => {
    const fetchAll = async () => {
      if (!instructorId) return;
      setLoading(true);
      try {
        const [resAssignments, resRecent, resActiveStudents] = await Promise.all([
          fetch(`http://localhost:3001/instructor/dashboard/assignments?instructorId=${instructorId}`),
          fetch(`http://localhost:3001/instructor/dashboard/recent-submissions?instructorId=${instructorId}`),
          fetch(`http://localhost:3001/instructor/active-students`),
        ]);

        if (!resAssignments.ok) throw new Error("Failed to load assignments");
        if (!resRecent.ok) throw new Error("Failed to load recent submissions");
        if (!resActiveStudents.ok) throw new Error("Failed to load active students");

        const assignmentsData = await resAssignments.json();
        const recentData = await resRecent.json();
        const studentsData = await resActiveStudents.json();

        const list = (assignmentsData.assignments || []).map((a) => ({
          id: Number(a.id),
          title: String(a.title),
          submissions: Number(a.submissions || 0),
          pending: Number(a.pending || 0),
          avgGrade: a.avgGrade === null || a.avgGrade === undefined ? null : Number(a.avgGrade),
        }));

        setAssignments(list);
        setTotalAssignments(list.length);
        setRecentSubmissions((recentData.submissions || []).map((s) => ({
          id: String(s.id),
          student: String(s.student),
          assignment: String(s.assignment),
          grade: s.grade === null || s.grade === undefined ? null : Math.round(Number(s.grade)),
          status: String(s.status),
        })));
        setActiveStudents(studentsData.total ?? 0);

        const pendingTotal = list.reduce((acc, a) => acc + (a.pending || 0), 0);
        setPendingReviews(pendingTotal);

        const avgGrades = list.map((a) => a.avgGrade).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        if (avgGrades.length > 0) {
          setAvgClassGrade(avgGrades.reduce((a, b) => a + b, 0) / avgGrades.length);
        } else {
          setAvgClassGrade(null);
        }

        if (!selectedAssignment && list.length > 0) {
          setSelectedAssignment(String(list[0].id));
        }
      } catch (error) {
        console.error("Error fetching instructor dashboard data:", error);
        setAssignments([]);
        setRecentSubmissions([]);
        setGrades([]);
        setTotalAssignments(0);
        setPendingReviews(0);
        setAvgClassGrade(null);
      }
    };

    fetchAll().finally(() => setLoading(false));
  }, [instructorId]);

  useEffect(() => {
    const fetchGrades = async () => {
      if (!selectedAssignmentId) return;
      try {
        const res = await fetch(`http://localhost:3001/instructor/dashboard/grades?assignmentId=${selectedAssignmentId}`);
        if (!res.ok) throw new Error("Failed to load grades");
        const data = await res.json();
        setGrades((data.grades || []).map((g) => ({
          studentId: String(g.studentId),
          studentName: String(g.studentName),
          submissionId: String(g.submissionId),
          status: String(g.status),
          hasReport: Boolean(g.hasReport),
        })));
      } catch (error) {
        console.error("Error fetching grades:", error);
        setGrades([]);
      }
    };

    fetchGrades();
  }, [selectedAssignmentId]);

  const handleLogout = async () => {
    const user = JSON.parse(localStorage.getItem("user"));

    if (!user) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
      return;
    }

    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    }
  };

  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createLanguage, setCreateLanguage] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createPdf, setCreatePdf] = useState<File | null>(null);
  const [wCorrectness, setWCorrectness] = useState(40);
  const [wStyle, setWStyle] = useState(25);
  const [wReadability, setWReadability] = useState(20);
  const [wEfficiency, setWEfficiency] = useState(15);
  const [creating, setCreating] = useState(false);

  const handleCreateAssignment = async () => {
    if (!createTitle.trim() || !createPdf) {
      toast({
        title: "Missing fields",
        description: "Title and PDF are required.",
        variant: "destructive",
      });
      return;
    }
    if (!instructorId) {
      toast({
        title: "Not logged in",
        description: "Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const form = new FormData();
      form.append("instructor_id", String(instructorId));
      form.append("title", createTitle.trim());
      form.append("description", createDescription.trim());
      form.append("language", createLanguage.trim());
      if (createDueDate) form.append("due_date", createDueDate);
      form.append("correctness_weight", String(wCorrectness));
      form.append("style_weight", String(wStyle));
      form.append("readability_weight", String(wReadability));
      form.append("efficiency_weight", String(wEfficiency));
      form.append("pdf", createPdf);

      const res = await fetch("http://localhost:3001/instructor/assignments/create", {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create assignment");
      }

      toast({
        title: "Assignment created",
        description: "Your new assignment has been published.",
      });

      setShowCreateDialog(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateLanguage("");
      setCreateDueDate("");
      setCreatePdf(null);

      // Refresh dashboard data
      setLoading(true);
      const resAssignments = await fetch(`http://localhost:3001/instructor/dashboard/assignments?instructorId=${instructorId}`);
      const resRecent = await fetch(`http://localhost:3001/instructor/dashboard/recent-submissions?instructorId=${instructorId}`);
      const resActiveStudents = await fetch(`http://localhost:3001/instructor/active-students`);
      const [assignmentsData, recentData, studentsData] = await Promise.all([
        resAssignments.json(),
        resRecent.json(),
        resActiveStudents.json(),
      ]);
      const list = (assignmentsData.assignments || []).map((a) => ({
        id: Number(a.id),
        title: String(a.title),
        submissions: Number(a.submissions || 0),
        pending: Number(a.pending || 0),
        avgGrade: a.avgGrade === null || a.avgGrade === undefined ? null : Number(a.avgGrade),
      }));
      setAssignments(list);
      setTotalAssignments(list.length);
      setRecentSubmissions((recentData.submissions || []).map((s) => ({
        id: String(s.id),
        student: String(s.student),
        assignment: String(s.assignment),
        grade: s.grade === null || s.grade === undefined ? null : Math.round(Number(s.grade)),
        status: String(s.status),
      })));
      setActiveStudents(studentsData.total ?? 0);
      if (list.length > 0) setSelectedAssignment(String(list[0].id));
    } catch (e) {
      toast({
        title: "Create failed",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
      setLoading(false);
    }
  };

  const refreshGradesForAssignment = async () => {
    if (!selectedAssignmentId) return;
    try {
      const res = await fetch(
        `http://localhost:3001/instructor/dashboard/grades?assignmentId=${selectedAssignmentId}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setGrades((data.grades || []).map((g) => ({
        studentId: String(g.studentId),
        studentName: String(g.studentName),
        submissionId: String(g.submissionId),
        status: String(g.status),
        hasReport: Boolean(g.hasReport),
      })));
    } catch {
      /* keep existing grades on refresh failure */
    }
  };

  const handleTriggerEvaluation = async (submissionId: string) => {
    setTriggeringSubmissionId(submissionId);
    try {
      await evaluationApi.trigger(submissionId);
      toast({
        title: "Evaluation completed",
        description: "AI evaluation finished for this submission.",
      });
      await refreshGradesForAssignment();
      navigate(`/feedback/${submissionId}`);
    } catch (error: any) {
      toast({
        title: "Failed to trigger evaluation",
        description: error?.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setTriggeringSubmissionId(null);
    }
  };

  const toggleSubmissionSelected = (submissionId: string) => {
    setSelectedSubmissionIds((prev) =>
      prev.includes(submissionId) ? prev.filter((id) => id !== submissionId) : [...prev, submissionId],
    );
  };

  const selectAllPendingSubmissions = () => {
    setSelectedSubmissionIds(pendingGradeRows.map((g) => g.submissionId));
  };

  const clearPendingSelection = () => setSelectedSubmissionIds([]);

  const handleHeaderSelectPending = (checked: boolean | "indeterminate") => {
    if (checked === true) selectAllPendingSubmissions();
    else clearPendingSelection();
  };

  const handleBatchTriggerEvaluation = async () => {
    if (selectedSubmissionIds.length === 0) return;
    setBatchEvaluating(true);
    try {
      const { data } = await evaluationApi.triggerBatch(selectedSubmissionIds);
      toast({
        title: "Batch evaluation finished",
        description: `${data.evaluated ?? 0} evaluated successfully. ${data.failed ?? 0} marked as error.`,
      });
      await refreshGradesForAssignment();
      clearPendingSelection();
    } catch (error: any) {
      toast({
        title: "Batch evaluation failed",
        description: error?.response?.data?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setBatchEvaluating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole="instructor" onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Instructor Dashboard</h1>
            <p className="text-muted-foreground">Manage assignments and review student submissions</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="shadow-soft">
                <Plus className="h-4 w-4 mr-2" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
                <DialogDescription>Configure your programming assignment and grading rubric</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Assignment Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Binary Search Implementation"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the assignment requirements..."
                    rows={4}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="language">Programming Language</Label>
                    <Input
                      id="language"
                      placeholder="C++ or Python"
                      value={createLanguage}
                      onChange={(e) => setCreateLanguage(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={createDueDate}
                      onChange={(e) => setCreateDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pdf">Assignment PDF</Label>
                  <Input
                    id="pdf"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setCreatePdf(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  <p className="text-sm text-muted-foreground">
                    Upload the PDF that contains the questions (Q1:, Q2:, ...). This is used by the LangGraph autograder.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Grading Weights</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="correctness" className="text-sm">Correctness (%)</Label>
                      <Input id="correctness" type="number" value={wCorrectness} onChange={(e) => setWCorrectness(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="style" className="text-sm">Code Style (%)</Label>
                      <Input id="style" type="number" value={wStyle} onChange={(e) => setWStyle(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="readability" className="text-sm">Readability (%)</Label>
                      <Input id="readability" type="number" value={wReadability} onChange={(e) => setWReadability(Number(e.target.value))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="efficiency" className="text-sm">Efficiency (%)</Label>
                      <Input id="efficiency" type="number" value={wEfficiency} onChange={(e) => setWEfficiency(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreateAssignment} disabled={creating}>
                  {creating ? "Creating..." : "Create Assignment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="flex justify-center">
          <div className="grid md:grid-cols-2 gap-4 mb-8 max-w-md w-full">
            
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Total Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAssignments}</div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Pending Evaluations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  {loading ? "..." : pendingReviews}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Assignments List */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Active Assignments</CardTitle>
              <CardDescription>Manage and monitor your assignments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium">{assignment.title}</h4>
                      {assignment.pending > 0 && (
                        <Badge className="bg-warning/10 text-warning border-warning/20">
                          {assignment.pending} pending
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Submissions</p>
                        <p className="font-medium">{assignment.submissions}</p>
                      </div>
                      <div className="text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate("/assignments")}>View All</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Submissions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
              <CardDescription>Latest student work awaiting review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSubmissions.map((submission, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{submission.student}</h4>
                        <p className="text-sm text-muted-foreground">{submission.assignment}</p>
                      </div>
                      {submission.status === "completed" ? (
                        <div className="text-right">
                          <Badge className="bg-success/10 text-success border-success/20">Evaluated</Badge>
                        </div>
                      ) : (
                        <Badge className="bg-warning/10 text-warning border-warning/20">Pending Evaluation</Badge>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() =>
                        submission.status === "completed"
                          ? navigate(`/feedback/${submission.id}`)
                          : handleTriggerEvaluation(submission.id)
                      }
                      disabled={batchEvaluating || triggeringSubmissionId === submission.id}
                    >
                      {submission.status === "completed"
                        ? "View Report"
                        : triggeringSubmissionId === submission.id
                          ? "Triggering..."
                          : "Trigger Evaluation"}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Grades Table */}
        <Card className="shadow-card mt-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Student Reports</CardTitle>
                <CardDescription>View all student reports for a specific assignment</CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={selectedSubmissionIds.length === 0 || batchEvaluating}
                  onClick={() => void handleBatchTriggerEvaluation()}
                >
                  {batchEvaluating
                    ? "Evaluating…"
                    : `Evaluate selected (${selectedSubmissionIds.length})`}
                </Button>
                <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id.toString()}>
                        {assignment.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={headerCheckboxState}
                        onCheckedChange={handleHeaderSelectPending}
                        disabled={pendingGradeRows.length === 0 || batchEvaluating}
                        aria-label="Select all pending submissions"
                      />
                    </TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead className="text-right">Report</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grades.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        {selectedAssignment ? "No grades yet for this assignment." : "Select an assignment to view grades."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    grades.map((student) => {
                      const isPending = !student.hasReport && student.status !== "completed";
                      return (
                        <TableRow key={student.submissionId || `${student.studentId}-${student.studentName}`}>
                          <TableCell className="w-10 align-middle">
                            {isPending ? (
                              <Checkbox
                                checked={selectedSubmissionIds.includes(student.submissionId)}
                                onCheckedChange={() => toggleSubmissionSelected(student.submissionId)}
                                disabled={batchEvaluating}
                                aria-label={`Select ${student.studentName}`}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell className="font-medium">{student.studentId}</TableCell>
                          <TableCell>{student.studentName}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                student.hasReport || student.status === "completed"
                                  ? navigate(`/feedback/${student.submissionId}`)
                                  : handleTriggerEvaluation(student.submissionId)
                              }
                              disabled={batchEvaluating || triggeringSubmissionId === student.submissionId}
                            >
                              {student.hasReport || student.status === "completed"
                                ? "View Report"
                                : triggeringSubmissionId === student.submissionId
                                  ? "Triggering..."
                                  : "Trigger Evaluation"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InstructorDashboard;
