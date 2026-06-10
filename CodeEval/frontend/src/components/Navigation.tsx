import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code2, LogOut } from "lucide-react";

interface NavigationProps {
  userRole?: "student" | "instructor" | "admin" | null;
  onLogout?: () => void;
}

const Navigation = ({ userRole, onLogout }: NavigationProps) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const homePath =
    userRole === "student"
      ? "/dashboard/student"
      : userRole === "instructor"
        ? "/dashboard/instructor"
        : userRole === "admin"
          ? "/dashboard/admin"
          : "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to={homePath} className="flex items-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary">
            <Code2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CodeEval
          </span>
        </Link>

        {userRole && (
          <nav className="flex items-center gap-6">
            {userRole === "student" && (
              <>
                <Link
                  to="/dashboard/student"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/dashboard/student") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/assignments"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/assignments") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Assignments
                </Link>
              </>
            )}
            {userRole === "instructor" && (
              <>
                <Link
                  to="/dashboard/instructor"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/dashboard/instructor") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/assignments"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    isActive("/assignments") ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Assignments
                </Link>
              </>
            )}
            {userRole === "admin" && (
              <Link
                to="/dashboard/admin"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/dashboard/admin") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Admin Panel
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </nav>
        )}

        {!userRole && location.pathname === "/" && (
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navigation;
