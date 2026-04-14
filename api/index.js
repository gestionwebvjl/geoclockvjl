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
// 3. SEDES (Versión Ultra-Segura)
// ==========================================

// LEER
app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    const { data, error } = await supabase.from('sedes').select('*');
    if (error) throw error;
    
    const sedesFormateadas = (data || []).map(s => ({
      id: s.id, 
      name: s.nombre, 
      address: s.address || '', 
      latitude: s.latitud, 
      longitude: s.longitud, 
      radius: s.radius || 100
    }));
    res.json(sedesFormateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREAR
app.post(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    const sedeTraducida = { 
      nombre: req.body.name, 
      latitud: req.body.latitude, 
      longitud: req.body.longitude, 
      address: req.body.address, 
      radius: req.body.radius 
    };

    const { data, error } = await supabase.from('sedes').insert([sedeTraducida]).select();
    
    if (error) return res.status(400).json({ error: error.message, origen: "Supabase Insert" });
    if (!data || data.length === 0) return res.status(400).json({ error: "No se devolvieron datos tras insertar" });

    res.status(201).json({ 
      id: data[0].id, 
      name: data[0].nombre, 
      latitude: data[0].latitud, 
      longitude: data[0].longitud, 
      radius: data[0].radius, 
      address: data[0].address 
    });
  } catch (err) {
    res.status(500).json({ error: err.message, origen: "Servidor Catch" });
  }
});

// MODIFICAR
app.put(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  try {
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
    if (!data || data.length === 0) return res.status(404).json({ error: "Sede no encontrada para actualizar" });
    
    res.json({ 
      id: data[0].id, 
      name: data[0].nombre, 
      latitude: data[0].latitud, 
      longitude: data[0].longitud, 
      radius: data[0].radius, 
      address: data[0].address 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// BORRAR
app.delete(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('sedes').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// ==========================================
// 4. FICHAJES (TRADUCTOR Frontend Inglés <-> BD Español)
// ==========================================

// 4.1 Historial de un usuario específico (Leer)
app.get("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('fichajes').select('*, sedes(nombre)').eq('empleado_id', id).order('fecha_hora', { ascending: false });
  if (error || !data) return res.json([]);
  
  // Traducimos al inglés para la app web
  const formateado = data.map(r => ({
    id: r.id,
    user_id: r.empleado_id,
    worksite_id: r.sede_id,
    type: r.tipo,
    latitude: r.latitud,
    longitude: r.longitud,
    distance: r.distancia_metros,
    notes: r.notes,
    timestamp: r.fecha_hora,
    worksite_name: r.sedes?.nombre || 'Sede desconocida'
  }));
  res.json(formateado);
});

// 4.2 Historial completo para el Panel de Admin (Leer)
app.get("/api/admin/records", async (req, res) => {
  const { data, error } = await supabase.from('fichajes').select('*, users(name), sedes(nombre)').order('fecha_hora', { ascending: false });
  if (error || !data) return res.json([]);
  
  const formateado = data.map(r => ({
    id: r.id,
    user_id: r.empleado_id,
    worksite_id: r.sede_id,
    type: r.tipo,
    latitude: r.latitud,
    longitude: r.longitud,
    distance: r.distancia_metros,
    notes: r.notes,
    timestamp: r.fecha_hora,
    user_name: r.users?.name || 'Usuario desconocido',
    worksite_name: r.sedes?.nombre || 'Sede desconocida'
  }));
  res.json(formateado);
});

// 4.3 Guardar un Fichaje (Escribir)
app.post("/api/clock", async (req, res) => {
  try {
    // Traducimos el inglés de la app al español de Supabase
    const nuevoFichajeEspañol = {
      empleado_id: req.body.user_id,
      sede_id: req.body.worksite_id,
      tipo: req.body.type,               // 'IN' o 'OUT'
      latitud: req.body.latitude,
      longitud: req.body.longitude,
      distancia_metros: req.body.distance,
      notes: req.body.notes || '',
      fecha_hora: new Date().toISOString() // Hora del servidor
    };

    const { data, error } = await supabase.from('fichajes').insert([nuevoFichajeEspañol]).select();
    if (error) return res.status(400).json({ error: error.message });
    
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.4 Saber si el empleado está trabajando ahora mismo
app.get("/api/status/:id", async (req, res) => {
  const { data } = await supabase.from('fichajes').select('*').eq('empleado_id', req.params.id).order('fecha_hora', { ascending: false }).limit(1);
  
  // Comprobamos si el último registro es una Entrada (IN)
  if (data && data.length > 0 && data[0].tipo === 'IN') {
    return res.json({ isClockedIn: true, startTime: data[0].fecha_hora });
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
