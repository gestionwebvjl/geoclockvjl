import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ==========================================
// 1. RUTA DE LOGIN
// ==========================================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password);

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });

    const user = data[0];
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: "Error interno", detalle: err.message });
  }
});

// ==========================================
// 2. RUTAS DE SEDES (WORKSITES)
// ==========================================
// Leer sedes (soporta ambas rutas por si acaso)
app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  const { data, error } = await supabase.from('sedes').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Crear sede
app.post("/api/admin/worksites", async (req, res) => {
  try {
    const { data, error } = await supabase.from('sedes').insert([req.body]).select();
    if (error) throw error; // Esto lanza el error al catch para que lo veamos
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message, datos_recibidos: req.body });
  }
});

// ==========================================
// 3. RUTAS DE USUARIOS (USERS)
// ==========================================
// Leer usuarios
app.get(["/api/users", "/api/admin/users"], async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// Crear usuario
app.post("/api/admin/users", async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').insert([req.body]).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: err.message, datos_recibidos: req.body });
  }
});

// ==========================================
// 4. CHIVATO DE RUTAS NO ENCONTRADAS
// ==========================================
app.use((req, res) => {
  res.status(404).json({ error: `Falta programar esta ruta: ${req.method} ${req.originalUrl}` });
});

export default app;
