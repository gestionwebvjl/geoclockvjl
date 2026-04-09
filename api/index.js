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
// RUTA DE ESTADO Y FICHAJES (Evita la pantalla blanca)
// ==========================================

// Leer estado del usuario (¿está trabajando ahora?)
app.get("/api/status/:id", async (req, res) => {
  // De momento devolvemos un estado inactivo genérico para que React pueda dibujar la pantalla
  res.json({ isWorking: false, lastEntry: null });
});

// Leer lista de fichajes (para tablas y gráficos)
app.get(["/api/attendance", "/api/admin/attendance"], async (req, res) => {
  // Buscamos los fichajes en Supabase (si tienes la tabla 'fichajes' o 'attendance')
  // Si no existe la tabla aún, esto no romperá la web gracias al catch
  try {
    const { data, error } = await supabase.from('attendance').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    // Si la tabla no existe en Supabase, devolvemos array vacío para no romper React
    res.json([]); 
  }
});

// ==========================================
// 4. SALVAVIDAS (Evita que React se quede en blanco)
// ==========================================
app.use((req, res) => {
  console.log(`[AVISO] La web intentó acceder a: ${req.method} ${req.originalUrl}`);
  
  // Si la web pide datos (GET) que no existen, devolvemos una lista vacía para que no se rompan los gráficos
  if (req.method === 'GET') {
    return res.json([]);
  }
  
  // Si intenta guardar algo (POST/PUT), sí mostramos el error
  res.status(404).json({ error: `Falta programar esta ruta: ${req.method} ${req.originalUrl}` });
});

export default app;
