import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCode2, Calendar, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { authApi, instructorApi, submissionApi } from "@/lib/api";

const Assignments = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const [userRole] = useState<"student" | "instructor">(role === "instructor" ? "instructor" : "student");
  const [assignments, setAssignments] = useState<
    Array<{
      id: number;
      title: string;
      description: string;
      language: string;
      dueDate: string | null;
      submissions: number;
      status: "active" | "overdue";
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      try {
        if (userRole === "student") {
          const { data } = await submissionApi.getAssignments();
          const normalized = (data.assignments || []).map((a: any) => {
            const due = a.due_date ? new Date(a.due_date) : null;
            return {
              id: Number(a.id),
              title: String(a.title || a.name || "Assignment"),
              description: String(a.description || "No description available"),
              language: String(a.language || "N/A"),
              dueDate: due ? due.toISOString() : null,
              submissions: 0,
              status: due && due.getTime() < Date.now() ? "overdue" : "active",
            };
          });
          setAssignments(normalized);
        } else {
          const { data } = await instructorApi.getAssignments(user?.user_id);
          const normalized = (data.assignments || []).map((a: any) => {
            const due = a.dueDate ? new Date(a.dueDate) : null;
            return {
              id: Number(a.id),
              title: String(a.title || "Assignment"),
              description: String(a.description || "No description available"),
              language: String(a.language || "N/A"),
              dueDate: due ? due.toISOString() : null,
              submissions: Number(a.submissions || 0),
              status: due && due.getTime() < Date.now() ? "overdue" : "active",
            };
          });
          setAssignments(normalized);
        }
      } catch (error) {
        console.error("Failed to load assignments:", error);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [userRole, user?.user_id]);

  const emptyMessage = useMemo(
    () =>
      userRole === "student"
        ? "No assignments available yet."
        : "No assignments created yet. Use Create New Assignment to add one.",
    [userRole],
  );

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <Navigation userRole={userRole} onLogout={handleLogout}/>
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            {userRole === "student" ? "My Assignments" : "Manage Assignments"}
          </h1>
          <p className="text-muted-foreground">
            {userRole === "student" 
              ? "View and submit your programming assignments"
              : "Manage course assignments"}
          </p>
        </div>

        <div className="grid gap-6">
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading assignments...</CardContent>
            </Card>
          ) : assignments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">{emptyMessage}</CardContent>
            </Card>
          ) : assignments.map((assignment) => (
            <Card key={assignment.id} className="hover:shadow-elegant transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{assignment.title}</CardTitle>
                      <Badge variant={assignment.status === "active" ? "default" : "destructive"}>
                        {assignment.status === "active" ? "Active" : "Overdue"}
                      </Badge>
                      <Badge variant="outline">{assignment.language}</Badge>
                    </div>
                    <CardDescription>{assignment.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : "Not set"}
                      </span>
                    </div>
                    {userRole === "instructor" && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{assignment.submissions} submissions</span>
                      </div>
                    )}
                  </div>
                  <Link to={`/assignments/${assignment.id}`}>
                    <Button variant="outline">
                      {userRole === "student" ? "View & Submit" : "Manage"}
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Assignments;
