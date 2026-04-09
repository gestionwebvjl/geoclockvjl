import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL?.trim() || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
);

// ==========================================
// 1. LOGIN
// ==========================================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password);
    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(401).json({ error: "Credenciales inválidas" });
    const user = data[0];
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. USUARIOS (CRUD Completo)
// ==========================================
app.get(["/api/users", "/api/admin/users"], async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  res.json(error ? [] : data);
});

app.post(["/api/users", "/api/admin/users"], async (req, res) => {
  const { data, error } = await supabase.from('users').insert([req.body]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

app.put(["/api/users/:id", "/api/admin/users/:id"], async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('users').update(req.body).eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

app.delete(["/api/users/:id", "/api/admin/users/:id"], async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 3. SEDES (BILINGÜE: Frontend <-> Supabase)
// ==========================================

// LEER (Español -> Inglés)
app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  const { data, error } = await supabase.from('sedes').select('*');
  if (error || !data) return res.json([]);
  
  // Traducimos lo que sale de la base de datos para que la web lo entienda
  const sedesFormateadas = data.map(sede => ({
    id: sede.id,
    name: sede.nombre,
    latitude: sede.latitud,
    longitude: sede.longitud,
    radius: 100 // Dato por defecto para que la web no se queje
  }));
  res.json(sedesFormateadas);
});

// CREAR (Inglés -> Español)
app.post(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    const sedeTraducida = {
      nombre: req.body.name,
      latitud: req.body.latitude,
      longitud: req.body.longitude
    };

    const { data, error } = await supabase.from('sedes').insert([sedeTraducida]).select();
    if (error) return res.status(400).json({ error: error.message });
    
    // Devolvemos la respuesta en inglés
    res.status(201).json({
      id: data[0].id,
      name: data[0].nombre,
      latitude: data[0].latitud,
      longitude: data[0].longitud,
      radius: 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MODIFICAR (Inglés -> Español)
app.put(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const sedeTraducida = {
      nombre: req.body.name,
      latitud: req.body.latitude,
      longitud: req.body.longitude
    };

    const { data, error } = await supabase.from('sedes').update(sedeTraducida).eq('id', id).select();
    if (error) return res.status(400).json({ error: error.message });
    
    // Devolvemos la respuesta en inglés
    res.json({
      id: data[0].id,
      name: data[0].nombre,
      latitude: data[0].latitud,
      longitude: data[0].longitud,
      radius: 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BORRAR (El ID es universal)
app.delete(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('sedes').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 4. FICHAJES Y ESTADO
// ==========================================
app.get("/api/status/:id", (req, res) => res.json({ isWorking: false, lastEntry: null }));
app.get(["/api/attendance", "/api/admin/attendance"], async (req, res) => {
  const { data, error } = await supabase.from('attendance').select('*');
  res.json(error ? [] : data);
});

// ==========================================
// 5. SALVAVIDAS FINAL
// ==========================================
app.use((req, res) => {
  if (req.method === 'GET') return res.json([]);
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

export default app;
