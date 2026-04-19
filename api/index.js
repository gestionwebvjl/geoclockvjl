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

app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    const { data, error } = await supabase.from('sedes').select('*');
    if (error) throw error;
    const sedesFormateadas = (data || []).map(s => ({
      id: s.id, name: s.nombre, address: s.address || '', latitude: s.latitud, longitude: s.longitud, radius: s.radius || 100
    }));
    res.json(sedesFormateadas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    const sedeTraducida = { nombre: req.body.name, latitud: req.body.latitude, longitud: req.body.longitude, address: req.body.address, radius: req.body.radius };
    const { data, error } = await supabase.from('sedes').insert([sedeTraducida]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ id: data[0].id, name: data[0].nombre, latitude: data[0].latitud, longitude: data[0].longitud, radius: data[0].radius, address: data[0].address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  try {
    const { id } = req.params;
    const sedeTraducida = { nombre: req.body.name, latitud: req.body.latitude, longitud: req.body.longitude, address: req.body.address, radius: req.body.radius };
    const { data, error } = await supabase.from('sedes').update(sedeTraducida).eq('id', id).select();
    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(404).json({ error: "Sede no encontrada" });
    res.json({ id: data[0].id, name: data[0].nombre, latitude: data[0].latitud, longitude: data[0].longitud, radius: data[0].radius, address: data[0].address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.get("/api/records/:id", async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('fichajes').select('*, sedes(nombre)').eq('empleado_id', id).order('fecha_hora', { ascending: false });
  if (error || !data) return res.json([]);
  res.json(data.map(r => ({
    id: r.id, user_id: r.empleado_id, worksite_id: r.sede_id, type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT', latitude: r.latitud, longitude: r.longitud, distance: r.distancia_metros, notes: r.notes, timestamp: r.fecha_hora, worksite_name: r.sedes?.nombre || 'Sede desconocida', minutos_extra: r.minutos_extra, estado_extra: r.estado_extra
  })));
});

app.get("/api/admin/records", async (req, res) => {
  const { data, error } = await supabase.from('fichajes').select('*, users(name), sedes(nombre)').order('fecha_hora', { ascending: false });
  if (error || !data) return res.json([]);
  res.json(data.map(r => ({
    id: r.id, user_id: r.empleado_id, worksite_id: r.sede_id, type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT', latitude: r.latitud, longitude: r.longitud, distance: r.distancia_metros, notes: r.notes, timestamp: r.fecha_hora, user_name: r.users?.name || 'Usuario desconocido', worksite_name: r.sedes?.nombre || 'Sede desconocida', minutos_extra: r.minutos_extra, estado_extra: r.estado_extra
  })));
});

app.post("/api/clock", async (req, res) => {
  try {
    const nuevo = { empleado_id: req.body.user_id, sede_id: req.body.worksite_id, tipo: req.body.type === 'IN' ? 'Entrada Jornada' : 'Salida Jornada', latitud: req.body.latitude, longitud: req.body.longitude, distancia_metros: req.body.distance, notes: req.body.notes || '', fecha_hora: new Date().toISOString(), minutos_extra: req.body.minutos_extra || 0, estado_extra: req.body.estado_extra || 'N/A' };
    const { data, error } = await supabase.from('fichajes').insert([nuevo]).select();
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/status/:id", async (req, res) => {
  const { data } = await supabase.from('fichajes').select('*').eq('empleado_id', req.params.id).order('fecha_hora', { ascending: false }).limit(1);
  if (data && data.length > 0 && data[0].tipo === 'Entrada Jornada') return res.json({ isClockedIn: true, startTime: data[0].fecha_hora });
  res.json({ isClockedIn: false, startTime: null });
});

app.get("/api/admin/stats", async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('id');
    const hoy = new Date().toISOString().split('T')[0];
    const { data: fichajesHoy } = await supabase.from('fichajes').select('*').gte('fecha_hora', hoy);
    let totalMs = 0; const porEmpleado = {};
    (fichajesHoy || []).forEach(f => { if (!porEmpleado[f.empleado_id]) porEmpleado[f.empleado_id] = []; porEmpleado[f.empleado_id].push(f); });
    Object.values(porEmpleado).forEach(fichajes => {
      fichajes.sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
      for (let i = 0; i < fichajes.length - 1; i++) { if (fichajes[i].tipo === 'Entrada Jornada' && fichajes[i+1].tipo === 'Salida Jornada') { totalMs += new Date(fichajes[i+1].fecha_hora).getTime() - new Date(fichajes[i].fecha_hora).getTime(); i++; } }
    });
    const horasHoy = (totalMs / 3600000).toFixed(1);
    const alertas = (fichajesHoy || []).filter(f => f.distancia_metros > 100 || f.estado_extra === 'PENDIENTE').length;
    res.json({ activeEmployees: users?.length || 0, totalHoursToday: horasHoy, pendingAlerts: alertas });
  } catch (err) { res.json({ activeEmployees: 0, totalHoursToday: "0.0", pendingAlerts: 0 }); }
});

app.get("/api/admin/pending-records", async (req, res) => {
  try {
    const { data, error } = await supabase.from('fichajes').select('*, users(name), sedes(nombre)').or('distancia_metros.gt.100,estado_extra.eq.PENDIENTE').order('fecha_hora', { ascending: false });
    if (error || !data) return res.json([]);
    res.json(data.map(r => ({ id: r.id, user_name: r.users?.name || 'Usuario desconocido', worksite_name: r.sedes?.nombre || 'Sede desconocida', type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT', timestamp: r.fecha_hora, distance: r.distancia_metros, minutos_extra: r.minutos_extra, estado_extra: r.estado_extra })));
  } catch (err) { res.json([]); }
});

app.post("/api/admin/records/approve", async (req, res) => {
  try {
    const { id, status } = req.body;
    if (status === 'REJECTED') await supabase.from('fichajes').update({ estado_extra: 'RECHAZADO', minutos_extra: 0 }).eq('id', id);
    else await supabase.from('fichajes').update({ distancia_metros: 0, estado_extra: 'APROBADO', notes: 'Aprobado por el Administrador' }).eq('id', id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default app;
