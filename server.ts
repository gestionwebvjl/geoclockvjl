import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js'; // <-- NUEVO
import dotenv from 'dotenv';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// REEMPLAZAMOS SQLite por Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // NUEVA RUTA DE CLOCK (Fichaje) con Validación de 15m
  app.post("/api/clock", async (req, res) => {
    const { user_id, worksite_id, type, latitude, longitude, notes } = req.body;
    
    // 1. Validar distancia en el servidor usando la función SQL que creamos
    const { data: estaCerca, error: geoError } = await supabase.rpc('validar_proximidad', {
      p_lat: latitude,
      p_lon: longitude,
      p_sede_id: worksite_id,
      p_radio_metros: 15 // Tu restricción de 15 metros
    });

    if (geoError || !estaCerca) {
      return res.status(403).json({ 
        error: "Fuera de rango", 
        message: "Debes estar a menos de 15 metros de la sede para fichar." 
      });
    }

    // 2. Insertar el registro si está cerca
    const { data, error } = await supabase
      .from('fichajes')
      .insert([{ 
        empleado_id: user_id, 
        sede_id: worksite_id, 
        tipo: type === 'IN' ? 'entrada' : 'salida',
        distancia_metros: 0 // Aquí podrías calcular la distancia real si quieres guardarla
      }])
      .select();

    if (error) return res.status(400).json(error);
    res.json({ id: data[0].id });
  });

  // ... (El resto de las rutas se irán migrando de db.prepare a supabase.from)
// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    employee_id TEXT,
    department TEXT,
    role TEXT DEFAULT 'USER', -- 'USER', 'ADMIN'
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'OFF'
    position TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    avatar_url TEXT
  );

  CREATE TABLE IF NOT EXISTS worksites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    latitude REAL,
    longitude REAL,
    address TEXT,
    radius REAL DEFAULT 10,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    worksite_id INTEGER,
    type TEXT, -- 'IN', 'OUT'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    latitude REAL,
    longitude REAL,
    distance REAL,
    is_manual INTEGER DEFAULT 0,
    audit_log TEXT,
    status TEXT DEFAULT 'APPROVED', -- 'PENDING', 'APPROVED', 'REJECTED'
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(worksite_id) REFERENCES worksites(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed data if empty
const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  // Admin User
  db.prepare("INSERT INTO users (email, password, name, employee_id, department, role, position) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "admin@empresa.com",
    "admin123",
    "Admin Principal",
    "ADM-001",
    "Sistemas",
    "ADMIN",
    "Director de Operaciones"
  );

  // Standard User
  db.prepare("INSERT INTO users (email, password, name, employee_id, department, role, position) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "john@empresa.com",
    "password123",
    "John Doe",
    "EMP-1024",
    "Ingeniería",
    "USER",
    "Ingeniero de Software Senior"
  );
  
  db.prepare("INSERT INTO worksites (name, latitude, longitude, address, radius) VALUES (?, ?, ?, ?, ?)").run(
    "Sede Central - Madrid",
    40.416775,
    -3.703790,
    "Puerta del Sol, Madrid",
    10
  );
  db.prepare("INSERT INTO worksites (name, latitude, longitude, address, radius) VALUES (?, ?, ?, ?, ?)").run(
    "Oficina Norte - Alcobendas",
    40.5475,
    -3.6421,
    "Av. de España, Alcobendas",
    25
  );

  // Seed some pending records for testing
  db.prepare(`
    INSERT INTO records (user_id, worksite_id, type, timestamp, notes, is_manual, audit_log, status, distance)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'PENDING', 0)
  `).run(2, 1, 'IN', '2026-03-22T08:00:00Z', 'Olvidé fichar al entrar', 'Solicitud manual del usuario');
  
  db.prepare(`
    INSERT INTO records (user_id, worksite_id, type, timestamp, notes, is_manual, audit_log, status, distance)
    VALUES (?, ?, ?, ?, ?, 1, ?, 'PENDING', 0)
  `).run(2, 1, 'OUT', '2026-03-22T17:30:00Z', 'Salida tarde por reunión', 'Solicitud manual del usuario');
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password) as any;
    if (user) {
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } else {
      res.status(401).json({ error: "Credenciales inválidas" });
    }
  });

  app.get("/api/worksites", (req, res) => {
    const worksites = db.prepare("SELECT * FROM worksites").all();
    res.json(worksites);
  });

  app.post("/api/clock", (req, res) => {
    const { user_id, worksite_id, type, latitude, longitude, distance, notes } = req.body;
    
    // Server-side distance check (optional but good practice)
    // For now we trust the client's distance calculation or just log it
    
    const result = db.prepare(`
      INSERT INTO records (user_id, worksite_id, type, latitude, longitude, distance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, worksite_id, type, latitude, longitude, distance, notes);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.get("/api/status/:userId", (req, res) => {
    const lastRecord = db.prepare(`
      SELECT * FROM records 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `).get(req.params.userId) as any;
    
    if (lastRecord && lastRecord.type === 'IN') {
      res.json({ isClockedIn: true, startTime: lastRecord.timestamp, worksiteId: lastRecord.worksite_id });
    } else {
      res.json({ isClockedIn: false });
    }
  });

  app.get("/api/records/:userId", (req, res) => {
    const records = db.prepare(`
      SELECT r.*, w.name as worksite_name 
      FROM records r 
      JOIN worksites w ON r.worksite_id = w.id 
      WHERE r.user_id = ? 
      ORDER BY r.timestamp DESC
    `).all(req.params.userId);
    res.json(records);
  });

  app.get("/api/stats/:userId", (req, res) => {
    // Simple stats for the demo
    const records = db.prepare(`
      SELECT * FROM records WHERE user_id = ? AND timestamp >= date('now', '-7 days')
    `).all(req.params.userId);
    res.json(records);
  });

  app.post("/api/users/update", (req, res) => {
    const { id, name, department } = req.body;
    db.prepare("UPDATE users SET name = ?, department = ? WHERE id = ?").run(name, department, id);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  });

  app.post("/api/users/change-password", (req, res) => {
    const { id, oldPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND password = ?").get(id, oldPassword) as any;
    if (user) {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(newPassword, id);
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Contraseña actual incorrecta" });
    }
  });

  app.get("/api/admin/stats", (req, res) => {
    const activeEmployees = db.prepare("SELECT count(*) as count FROM users WHERE status = 'ACTIVE'").get() as any;
    const pendingAlerts = db.prepare("SELECT count(*) as count FROM records WHERE status = 'PENDING'").get() as any;
    
    // Calculate total hours today
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = db.prepare(`
      SELECT * FROM records 
      WHERE timestamp LIKE ? 
      ORDER BY user_id, timestamp ASC
    `).all(today + '%') as any[];

    let totalMs = 0;
    const userRecords: any[][] = [];
    const userMap = new Map();
    
    todayRecords.forEach(r => {
      if (!userMap.has(r.user_id)) {
        userMap.set(r.user_id, []);
        userRecords.push(userMap.get(r.user_id));
      }
      userMap.get(r.user_id).push(r);
    });

    userRecords.forEach(records => {
      for (let i = 0; i < records.length; i++) {
        if (records[i].type === 'IN' && records[i+1]?.type === 'OUT') {
          totalMs += new Date(records[i+1].timestamp).getTime() - new Date(records[i].timestamp).getTime();
          i++;
        }
      }
    });

    const totalHoursToday = (totalMs / 3600000).toFixed(1);
    
    res.json({
      activeEmployees: activeEmployees.count,
      totalHoursToday,
      pendingAlerts: pendingAlerts.count
    });
  });

  app.get("/api/admin/pending-records", (req, res) => {
    const records = db.prepare(`
      SELECT r.*, u.name as user_name, w.name as worksite_name 
      FROM records r 
      JOIN users u ON r.user_id = u.id
      JOIN worksites w ON r.worksite_id = w.id 
      WHERE r.status = 'PENDING'
      ORDER BY r.timestamp DESC
    `).all();
    res.json(records);
  });

  app.get("/api/admin/records", (req, res) => {
    const records = db.prepare(`
      SELECT r.*, u.name as user_name, w.name as worksite_name 
      FROM records r 
      JOIN users u ON r.user_id = u.id
      JOIN worksites w ON r.worksite_id = w.id 
      ORDER BY r.timestamp DESC
    `).all();
    res.json(records);
  });

  app.post("/api/admin/records/approve", (req, res) => {
    const { id, status, audit_log } = req.body;
    db.prepare("UPDATE records SET status = ?, audit_log = ? WHERE id = ?").run(status, audit_log, id);
    res.json({ success: true });
  });

  app.get("/api/admin/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.post("/api/admin/users", (req, res) => {
    const { email, password, name, employee_id, department, role, position } = req.body;
    try {
      const result = db.prepare(`
        INSERT INTO users (email, password, name, employee_id, department, role, position)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(email, password, name, employee_id, department, role || 'USER', position);
      res.json({ id: result.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/users/status", (req, res) => {
    const { id, status } = req.body;
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
    res.json({ success: true });
  });

  app.put("/api/admin/users/:id", (req, res) => {
    const { id } = req.params;
    const { email, password, name, employee_id, department, role, position } = req.body;
    db.prepare(`
      UPDATE users 
      SET email = ?, password = ?, name = ?, employee_id = ?, department = ?, role = ?, position = ?
      WHERE id = ?
    `).run(email, password, name, employee_id, department, role, position, id);
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/records/discard/:userId", (req, res) => {
    const userId = req.params.userId;
    // Find the last record for this user
    const lastRecord = db.prepare("SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1").get(userId) as any;
    
    if (lastRecord && lastRecord.type === 'IN') {
      db.prepare("DELETE FROM records WHERE id = ?").run(lastRecord.id);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "No hay un turno activo para descartar" });
    }
  });

  app.get("/api/admin/worksites", (req, res) => {
    const worksites = db.prepare("SELECT * FROM worksites").all();
    res.json(worksites);
  });

  app.post("/api/admin/worksites", (req, res) => {
    const { name, latitude, longitude, address, radius } = req.body;
    const result = db.prepare("INSERT INTO worksites (name, latitude, longitude, address, radius) VALUES (?, ?, ?, ?, ?)").run(name, latitude, longitude, address, radius);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/admin/worksites/:id", (req, res) => {
    const { name, latitude, longitude, address, radius } = req.body;
    db.prepare(`
      UPDATE worksites 
      SET name = ?, latitude = ?, longitude = ?, address = ?, radius = ? 
      WHERE id = ?
    `).run(name, latitude, longitude, address, radius, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/worksites/:id", (req, res) => {
    db.prepare("DELETE FROM worksites WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/records/manual", (req, res) => {
    const { user_id, worksite_id, type, timestamp, notes, audit_log } = req.body;
    const result = db.prepare(`
      INSERT INTO records (user_id, worksite_id, type, timestamp, notes, is_manual, audit_log, distance)
      VALUES (?, ?, ?, ?, ?, 1, ?, 0)
    `).run(user_id, worksite_id, type, timestamp, notes, audit_log);
    res.json({ id: result.lastInsertRowid });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
