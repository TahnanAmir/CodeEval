import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileCode, CheckCircle2, Clock, XCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import { authApi, submissionApi } from "@/lib/api";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<string>("");
  const [assignments, setAssignments] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [pending, setPending] = useState(0);
  const [submissions, setSubmissions] = useState<any[]>([]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSelectedFiles(files);
  };

  const validateQFilenames = (files: File[]) => {
    const invalid = files.filter((f) => !/^q_\w+/i.test(f.name));
    return invalid;
  };

  const formatSelectedFilesLabel = (files: File[]) => {
    if (files.length === 0) return "";
    if (files.length === 1) return `Selected: ${files[0].name} (${(files[0].size / 1024).toFixed(1)} KB)`;
    return `Selected ${files.length} files (expected names like q_1.py, q_2.py, ...)`;
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !selectedAssignment) {
      toast({
        title: "Error",
        description: "Please select code files (q_1.*, q_2.*, ...) and an assignment",
        variant: "destructive",
      });
      return;
    }

    const invalidFiles = validateQFilenames(selectedFiles);
    if (invalidFiles.length > 0) {
      toast({
        title: "Invalid filenames",
        description: `Rename your files to start with q_ (e.g., q_1.py). Invalid: ${invalidFiles
          .slice(0, 3)
          .map((f) => f.name)
          .join(", ")}${invalidFiles.length > 3 ? "..." : ""}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("code_files", file);
      });
      formData.append("assignment_id", selectedAssignment);

      const { data: result } = await submissionApi.upload(formData);
      
      toast({
        title: "Submission received",
        description: "Your code is being evaluated by AI...",
      });

      // Reset form
      setSelectedFiles([]);
      setSelectedAssignment("");
      
      // Refresh data
      await fetchData();
      
    } catch (error) {
      console.error("Submission error:", error);
      const message =
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        "Please try again";
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      const [{ data: statsData }, { data: historyData }, { data: assignmentsData }] = await Promise.all([
        submissionApi.getStats(),
        submissionApi.getMine(),
        submissionApi.getAssignments(),
      ]);

      setCount(statsData.total || 0);
      setCompleted(statsData.completed || 0);
      setPending(statsData.pending || 0);
      setSubmissions(historyData.submissions || []);
      setAssignments(assignmentsData.assignments || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.user_id) return;

    fetchData();
  }, []);

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


  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Evaluating</Badge>;
      case "failed":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Failed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole="student" onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
          <p className="text-muted-foreground">Upload assignments and track your progress</p>
        </div>

        {/* File Upload Section */}
        <Card className="shadow-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit Assignment
            </CardTitle>
            <CardDescription>Upload your code file for AI evaluation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assignment">Select Assignment</Label>
              <Select value={selectedAssignment} onValueChange={setSelectedAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an assignment" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={String(assignment.id)}>
                      {assignment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="file">Upload Code Files</Label>
              <p className="text-sm text-muted-foreground">
                Upload one file per question. Filenames must start with `q_` (e.g., `q_1.py`, `q_2.py`).
              </p>
              <Input
                id="file"
                type="file"
                multiple
                accept=".py,.cpp"
                onChange={handleFilesChange}
                className="cursor-pointer"
              />
              {selectedFiles.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formatSelectedFilesLabel(selectedFiles)}
                </p>
              )}
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={selectedFiles.length === 0 || !selectedAssignment || submitting}
              className="w-full"
            >
              <FileCode className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit Assignment"}
            </Button>
          </CardContent>
        </Card>

        {/* All Submissions */}
        <Card className="shadow-card mb-8">
          <CardHeader>
            <CardTitle>All Submissions</CardTitle>
            <CardDescription>View your assignment history and results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No submissions yet. Upload your first assignment above!
                </p>
              ) : (
                submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(submission.status)}
                      <div>
                        <h4 className="font-medium">{submission.assignment}</h4>
                        <p className="text-sm text-muted-foreground">Submitted on {submission.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(submission.status)}
                      {submission.grade !== null && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-success">{submission.grade}%</div>
                        </div>
                      )}
                      {submission.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/feedback/${submission.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Report
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Section */}
        <div className="grid grid-cols-3 lg:grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {loading ? "..." : count}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Total assignments</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-success">{completed}</div>
                <p className="text-sm text-muted-foreground mt-1">Successfully evaluated</p>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-warning">{pending}</div>
                <p className="text-sm text-muted-foreground mt-1">Being evaluated</p>
              </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
