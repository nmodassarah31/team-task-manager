import { useState, useEffect } from "react";

const API = "http://127.0.0.1:8000";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [userName, setUserName] = useState(localStorage.getItem("userName") || "");
  const [page, setPage] = useState("login");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auth forms
  const [authData, setAuthData] = useState({ name: "", email: "", password: "", role: "Member" });

  // Project form
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });

  // Task form
  const [taskForm, setTaskForm] = useState({ title: "", description: "", assigned_to: "", project_id: "", status: "Todo" });

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (token) {
      setPage("dashboard");
      fetchAll();
    }
  }, [token]);

  async function fetchAll() {
    try {
      const [p, t, u] = await Promise.all([
        fetch(`${API}/projects`, { headers }).then(r => r.json()),
        fetch(`${API}/tasks`, { headers }).then(r => r.json()),
        fetch(`${API}/users`, { headers }).then(r => r.json()),
      ]);
      setProjects(Array.isArray(p) ? p : []);
      setTasks(Array.isArray(t) ? t : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch (e) {
      setError("Failed to fetch data");
    }
  }

  async function handleAuth(isLogin) {
    setError(""); setSuccess("");
    const url = isLogin ? `${API}/login` : `${API}/register`;
    const body = isLogin
      ? { email: authData.email, password: authData.password }
      : authData;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setError(data.detail || "Something went wrong"); return; }
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("userName", data.name);
    setToken(data.token); setRole(data.role); setUserName(data.name);
  }

  function logout() {
    localStorage.clear();
    setToken(""); setRole(""); setUserName("");
    setPage("login");
  }

  async function createProject() {
    setError(""); setSuccess("");
    if (!projectForm.name) { setError("Project name is required"); return; }
    const res = await fetch(`${API}/projects`, { method: "POST", headers, body: JSON.stringify(projectForm) });
    const data = await res.json();
    if (!res.ok) { setError(data.detail); return; }
    setSuccess("Project created!"); setProjectForm({ name: "", description: "" }); fetchAll();
  }

  async function createTask() {
    setError(""); setSuccess("");
    if (!taskForm.title) { setError("Task title is required"); return; }
    if (!taskForm.project_id) { setError("Please select a project"); return; }
    const res = await fetch(`${API}/tasks`, { method: "POST", headers, body: JSON.stringify(taskForm) });
    const data = await res.json();
    if (!res.ok) { setError(data.detail); return; }
    setSuccess("Task created!"); setTaskForm({ title: "", description: "", assigned_to: "", project_id: "", status: "Todo" }); fetchAll();
  }

  async function updateTaskStatus(taskId, newStatus) {
    await fetch(`${API}/tasks/${taskId}`, { method: "PATCH", headers, body: JSON.stringify({ status: newStatus }) });
    fetchAll();
  }

  async function deleteTask(taskId) {
    await fetch(`${API}/tasks/${taskId}`, { method: "DELETE", headers });
    fetchAll();
  }

  const statusColor = { "Todo": "bg-gray-100 text-gray-700", "In Progress": "bg-blue-100 text-blue-700", "Done": "bg-green-100 text-green-700" };
  const overdueTasks = tasks.filter(t => t.status !== "Done");

  if (!token) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-indigo-600 mb-2 text-center">TaskFlow</h1>
        <p className="text-gray-500 text-center mb-6">Team Task Manager</p>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setPage("login")} className={`flex-1 py-2 rounded-lg font-medium transition ${page === "login" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>Login</button>
          <button onClick={() => setPage("register")} className={`flex-1 py-2 rounded-lg font-medium transition ${page === "register" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>Register</button>
        </div>
        {page === "register" && (
          <div className="mb-4">
            <input className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Full Name" value={authData.name} onChange={e => setAuthData({ ...authData, name: e.target.value })} />
            <select className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={authData.role} onChange={e => setAuthData({ ...authData, role: e.target.value })}>
              <option value="Member">Member</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
        )}
        <input className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Email" value={authData.email} onChange={e => setAuthData({ ...authData, email: e.target.value })} />
        <input className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Password" type="password" value={authData.password} onChange={e => setAuthData({ ...authData, password: e.target.value })} />
        <button onClick={() => handleAuth(page === "login")} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition">
          {page === "login" ? "Login" : "Create Account"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center shadow">
        <h1 className="text-xl font-bold">TaskFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-indigo-200 text-sm">👤 {userName} <span className="bg-indigo-500 px-2 py-0.5 rounded-full text-xs ml-1">{role}</span></span>
          <button onClick={logout} className="bg-indigo-500 hover:bg-indigo-400 px-4 py-1.5 rounded-lg text-sm transition">Logout</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">{success}</div>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center"><p className="text-2xl font-bold text-indigo-600">{projects.length}</p><p className="text-gray-500 text-sm">Projects</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center"><p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === "Done").length}</p><p className="text-gray-500 text-sm">Completed</p></div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center"><p className="text-2xl font-bold text-orange-500">{overdueTasks.length}</p><p className="text-gray-500 text-sm">Pending</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Admin: Create Project */}
          {role === "Admin" && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">➕ New Project</h2>
              <input className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Project Name *" value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
              <input className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Description" value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} />
              <button onClick={createProject} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition">Create Project</button>
            </div>
          )}

          {/* Admin: Create Task */}
          {role === "Admin" && (
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">📋 New Task</h2>
              <input className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Task Title *" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
              <input className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Description" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
              <select className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={taskForm.project_id} onChange={e => setTaskForm({ ...taskForm, project_id: e.target.value })}>
                <option value="">Select Project *</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={taskForm.assigned_to} onChange={e => setTaskForm({ ...taskForm, assigned_to: e.target.value })}>
                <option value="">Assign to (optional)</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              <select className="w-full border rounded-lg p-2.5 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}>
                <option>Todo</option>
                <option>In Progress</option>
                <option>Done</option>
              </select>
              <button onClick={createTask} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition">Create Task</button>
            </div>
          )}

          {/* Projects List */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">📁 Projects</h2>
            {projects.length === 0 ? <p className="text-gray-400 text-sm">No projects yet</p> : projects.map(p => (
              <div key={p.id} className="border rounded-lg p-3 mb-2">
                <p className="font-medium text-gray-700">{p.name}</p>
                <p className="text-gray-400 text-sm">{p.description}</p>
              </div>
            ))}
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">✅ Tasks</h2>
            {tasks.length === 0 ? <p className="text-gray-400 text-sm">No tasks yet</p> : tasks.map(t => (
              <div key={t.id} className="border rounded-lg p-3 mb-2">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-gray-700">{t.title}</p>
                  {role === "Admin" && <button onClick={() => deleteTask(t.id)} className="text-red-400 hover:text-red-600 text-xs ml-2">🗑</button>}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[t.status]}`}>{t.status}</span>
                  <select className="text-xs border rounded p-1 focus:outline-none" value={t.status} onChange={e => updateTaskStatus(t.id, e.target.value)}>
                    <option>Todo</option>
                    <option>In Progress</option>
                    <option>Done</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;