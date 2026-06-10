import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Code2, Sparkles, BarChart3, Shield, Zap } from "lucide-react";
import Navigation from "@/components/Navigation";

const Landing = () => {
  return (
    <div className="min-h-screen">
      <Navigation />

      <section className="gradient-hero py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Code Evaluation</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Automate Code Grading with{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                AI Intelligence
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              CodeEval revolutionizes programming education with automated, intelligent code evaluation 
              that provides instant feedback and detailed analysis for C++ and Python assignments.
            </p>

            <div className="flex items-center justify-center gap-4 pt-4">
              <Link to="/register">
                <Button size="lg" className="shadow-glow">
                  Get Started Free
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Transform Code Education?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of educators using CodeEval to enhance their programming courses
          </p>
          <Link to="/register">
            <Button size="lg" className="shadow-glow">
              Start Evaluating Code Today
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2025 CodeEval. AI-powered code evaluation for modern education.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
