from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="Team Task Manager")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database
MONGO_URL = os.getenv("MONGO_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DATABASE_NAME]

# Auth setup
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# ─── Models ───────────────────────────────────────────────
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "Member"  # Admin or Member

class UserLogin(BaseModel):
    email: str
    password: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    assigned_to: Optional[str] = None
    project_id: str
    status: str = "Todo"  # Todo, In Progress, Done

class TaskUpdate(BaseModel):
    status: str

# ─── Auth Helpers ──────────────────────────────────────────
def hash_password(password):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_admin(current_user=Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return current_user

# ─── Routes ───────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Team Task Manager API is running"}

# Auth
@app.post("/register")
async def register(user: UserRegister):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(user.password)
    new_user = {"name": user.name, "email": user.email, "password": hashed, "role": user.role}
    result = await db.users.insert_one(new_user)
    token = create_token({"sub": str(result.inserted_id)})
    return {"token": token, "role": user.role, "name": user.name}

@app.post("/login")
async def login(user: UserLogin):
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": str(db_user["_id"])})
    return {"token": token, "role": db_user["role"], "name": db_user["name"]}

# Projects
@app.post("/projects")
async def create_project(project: ProjectCreate, current_user=Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admins only")
    new_project = {"name": project.name, "description": project.description, "created_by": str(current_user["_id"]), "created_at": datetime.utcnow()}
    result = await db.projects.insert_one(new_project)
    return {"id": str(result.inserted_id), "name": project.name}

@app.get("/projects")
async def get_projects(current_user=Depends(get_current_user)):
    projects = await db.projects.find().to_list(100)
    return [{"id": str(p["_id"]), "name": p["name"], "description": p.get("description", "")} for p in projects]

# Tasks
@app.post("/tasks")
async def create_task(task: TaskCreate, current_user=Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admins only")
    new_task = {"title": task.title, "description": task.description, "assigned_to": task.assigned_to, "project_id": task.project_id, "status": task.status, "created_at": datetime.utcnow()}
    result = await db.tasks.insert_one(new_task)
    return {"id": str(result.inserted_id), "title": task.title}

@app.get("/tasks")
async def get_tasks(current_user=Depends(get_current_user)):
    tasks = await db.tasks.find().to_list(100)
    return [{"id": str(t["_id"]), "title": t["title"], "status": t["status"], "assigned_to": t.get("assigned_to"), "project_id": t.get("project_id")} for t in tasks]

@app.patch("/tasks/{task_id}")
async def update_task_status(task_id: str, update: TaskUpdate, current_user=Depends(get_current_user)):
    result = await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": update.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Status updated"}

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] != "Admin":
        raise HTTPException(status_code=403, detail="Admins only")
    await db.tasks.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted"}

@app.get("/users")
async def get_users(current_user=Depends(get_current_user)):
    users = await db.users.find().to_list(100)
    return [{"id": str(u["_id"]), "name": u["name"], "email": u["email"], "role": u["role"]} for u in users]