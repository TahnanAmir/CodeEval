import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Settings, Activity, Shield, Search, UserPlus, FileText, CheckCircle, Upload, Eye } from "lucide-react";
import { useEffect } from "react";
import { authApi } from "@/lib/api";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "student" });
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ id: number; name: string; email: string; role: string;} | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [systemStats, setSystemStats] = useState([
    { label: "Total Users", value: "0", icon: Users, color: "text-primary" },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:3001/admin/stats", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        setSystemStats([
          { label: "Total Users", value: data.totalUsers, icon: Users, color: "text-primary" },
        ]);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    };

    fetchStats();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://localhost:3001/admin/users", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data || []); 
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setUsers([]);
    }
  };

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

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.email) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/admin/add-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(newUser),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to add user");
      }

      toast({
        title: "User added successfully",
        description: `${data.user.full_name} has been added as a ${data.user.role}`,
      });

      setIsAddUserOpen(false);
      setNewUser({ name: "", email: "", role: "student" });

      fetchUsers();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: { id?: number; user_id?: number; full_name?: string; email: string; role: string; is_active?: boolean }) => {
    setEditingUser({
      id: user.id || user.user_id,
      name: user.full_name || "", 
      email: user.email,
      role: user.role,
    });
    setIsEditUserOpen(true);
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;

    try {
      const updatedUserData = {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
      };

      const res = await fetch(`http://localhost:3001/admin/update-user/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(updatedUserData),
      });

      if (!res.ok) throw new Error("Failed to update user");

      const data = await res.json();

      const updatedUser = {
        id: data.user.id,
        full_name: data.user.full_name,
        name: data.user.full_name,
        email: data.user.email,
        role: data.user.role,
        is_active: data.user.is_active,
        status: data.user.is_active ? "active" : "inactive",
      };

      setUsers((prev) =>
  prev.map((user) =>
    (user.id === editingUser.id || user.user_id === editingUser.id)
      ? { ...data.user, id: data.user.user_id }
      : user
  )
);

      setIsEditUserOpen(false);
      alert("User updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error updating user. Check console for details.");
    }
  };

  // Mock data
  const recentActivity = [
    { user: "Alice Johnson", action: "Submitted assignment", time: "5 minutes ago", type: "upload", icon: Upload },
    { user: "Dr. Carol White", action: "Created new assignment", time: "12 minutes ago", type: "create", icon: FileText },
    { user: "Bob Smith", action: "Viewed feedback", time: "23 minutes ago", type: "view", icon: Eye },
    { user: "System", action: "Backup completed", time: "1 hour ago", type: "success", icon: CheckCircle },
  ];

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation userRole="admin" onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">System management and user administration</p>
          </div>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-soft">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>Create a new user account in the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@university.edu"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
                <Button onClick={handleAddUser}>Create User</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription>Update user information and permissions</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    placeholder="Enter full name"
                    value={editingUser?.name || ""}
                    onChange={(e) => setEditingUser(editingUser ? { ...editingUser, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="user@university.edu"
                    value={editingUser?.email || ""}
                    onChange={(e) => setEditingUser(editingUser ? { ...editingUser, email: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role</Label>
                  <Select 
                    value={editingUser?.role || "student"} 
                    onValueChange={(value) => setEditingUser(editingUser ? { ...editingUser, role: value } : null)}
                  >
                    <SelectTrigger id="edit-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="instructor">Instructor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveUserEdit}>Save Changes</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {systemStats.map((stat, index) => (
            <Card key={index} className="shadow-card w-72">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-card lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage system users and access control</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{user.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={
                          user.role === "instructor"
                            ? "border-accent/20 text-accent"
                            : "border-primary/20 text-primary"
                        }
                      >
                        {user.role}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>Edit</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
