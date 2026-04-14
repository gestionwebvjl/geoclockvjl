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
// 2. USUARIOS
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
// 3. SEDES (Bilingüe Frontend <-> Supabase)
// ==========================================

// LEER
app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  const { data, error } = await supabase.from('sedes').select('*');
  if (error || !data) return res.json([]);
  const sedesFormateadas = data.map(s => ({
    id: s.id, name: s.nombre, address: s.address || '', latitude: s.latitud, longitude: s.longitud, radius: s.radius || 100
  }));
  res.json(sedesFormateadas);
});

// CREAR
app.post(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  const sedeTraducida = { nombre: req.body.name, latitud: req.body.latitude, longitud: req.body.longitude, address: req.body.address, radius: req.body.radius };
  const { data, error } = await supabase.from('sedes').insert([sedeTraducida]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ id: data[0].id, name: data[0].nombre, latitude: data[0].latitud, longitude: data[0].longitud, radius: data[0].radius, address: data[0].address });
});

// MODIFICAR (Aquí está el arreglo del Radio y la Dirección)
app.put(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  const { id } = req.params;
  const sedeTraducida = { 
    nombre: req.body.name, 
    latitud: req.body.latitude, 
    longitud: req.body.longitude, 
    address: req.body.address, 
    radius: req.body.radius 
  };
  
  const { data, error } = await supabase.from('sedes').update(sedeTraducida).eq('id', id).select();
  
  if (error) return res.status(400).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "Sede no encontrada" });
  
  res.json({ id: data[0].id, name: data[0].nombre, latitude: data[0].latitud, longitude: data[0].longitud, radius: data[0].radius, address: data[0].address });
});

// BORRAR
app.delete(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('sedes').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 4. FICHAJES (RECORDS)
// ==========================================

// Historial de un usuario específico
app.get("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('fichajes').select('*, sedes(nombre)').eq('user_id', id).order('timestamp', { ascending: false });
  if (error) return res.json([]);
  res.json(data.map(r => ({ ...r, worksite_name: r.sedes?.nombre || 'Sede desconocida' })));
});

// Historial completo para Admin
app.get("/api/admin/records", async (req, res) => {
  const { data, error } = await supabase.from('fichajes').select('*, users(name), sedes(nombre)').order('timestamp', { ascending: false });
  if (error) return res.json([]);
  res.json(data.map(r => ({ ...r, user_name: r.users?.name, worksite_name: r.sedes?.nombre })));
});

// Guardar fichaje
app.post("/api/clock", async (req, res) => {
  const nuevo = { ...req.body, timestamp: new Date().toISOString() };
  const { data, error } = await supabase.from('fichajes').insert([nuevo]).select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
});

// Estado actual
app.get("/api/status/:id", async (req, res) => {
  const { data } = await supabase.from('fichajes').select('*').eq('user_id', req.params.id).order('timestamp', { ascending: false }).limit(1);
  if (data && data.length > 0 && data[0].type === 'IN') {
    return res.json({ isClockedIn: true, startTime: data[0].timestamp });
  }
  res.json({ isClockedIn: false, startTime: null });
});

// ==========================================
// 5. ESTADÍSTICAS (STATS) - Requerido por Dashboard
// ==========================================
app.get("/api/admin/stats", async (req, res) => {
  const { data: users } = await supabase.from('users').select('id');
  const { data: fichajesHoy } = await supabase.from('fichajes').select('*').gte('timestamp', new Date().toISOString().split('T')[0]);
  
  res.json({
    activeEmployees: users?.length || 0,
    totalHoursToday: "0.0", // Cálculo simplificado
    pendingAlerts: fichajesHoy?.filter(f => f.distance > 100).length || 0
  });
});

// Salvavidas
app.use((req, res) => {
  if (req.method === 'GET') return res.json([]);
  res.status(404).json({ error: "Ruta no encontrada" });
});

export default app;
