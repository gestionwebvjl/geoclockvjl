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
  
  const formateado = data.map(r => ({
    id: r.id,
    user_id: r.empleado_id,
    worksite_id: r.sede_id,
    type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT', // <-- Traducimos de vuelta para que la web ponga el color correcto
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
    type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT',
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
    // TRADUCCIÓN: Convertimos el inglés a la regla estricta de Supabase
    const tipoTraducido = req.body.type === 'IN' ? 'Entrada Jornada' : 'Salida Jornada';

    const nuevoFichajeEspañol = {
      empleado_id: req.body.user_id,
      sede_id: req.body.worksite_id,
      tipo: tipoTraducido, 
      latitud: req.body.latitude,
      longitud: req.body.longitude,
      distancia_metros: req.body.distance,
      notes: req.body.notes || '',
      fecha_hora: new Date().toISOString()
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
  
  // Comprobamos si el último registro es la frase exacta "Entrada Jornada"
  if (data && data.length > 0 && data[0].tipo === 'Entrada Jornada') {
    return res.json({ isClockedIn: true, startTime: data[0].fecha_hora });
  }
  res.json({ isClockedIn: false, startTime: null });
});

// ==========================================
// 5. ESTADÍSTICAS (STATS) - Inteligencia Real
// ==========================================
app.get("/api/admin/stats", async (req, res) => {
  try {
    const { data: users } = await supabase.from('users').select('id');
    
    // Buscamos solo los fichajes de HOY
    const hoy = new Date().toISOString().split('T')[0];
    const { data: fichajesHoy } = await supabase.from('fichajes').select('*').gte('fecha_hora', hoy);

    // 1. Calculamos las HORAS TOTALES de hoy sumando los turnos cerrados
    let totalMs = 0;
    const porEmpleado = {};
    (fichajesHoy || []).forEach(f => {
      if (!porEmpleado[f.empleado_id]) porEmpleado[f.empleado_id] = [];
      porEmpleado[f.empleado_id].push(f);
    });

    Object.values(porEmpleado).forEach(fichajes => {
      fichajes.sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
      for (let i = 0; i < fichajes.length - 1; i++) {
        if (fichajes[i].tipo === 'Entrada Jornada' && fichajes[i+1].tipo === 'Salida Jornada') {
          totalMs += new Date(fichajes[i+1].fecha_hora).getTime() - new Date(fichajes[i].fecha_hora).getTime();
          i++; // Saltamos el de salida porque ya lo hemos emparejado
        }
      }
    });
    const horasHoy = (totalMs / 3600000).toFixed(1);

    // 2. Calculamos las ALERTAS (Gente que ha fichado a más de 100 metros)
    const alertas = (fichajesHoy || []).filter(f => f.distancia_metros > 100).length;

    res.json({
      activeEmployees: users?.length || 0,
      totalHoursToday: horasHoy,
      pendingAlerts: alertas
    });
  } catch (err) {
    res.json({ activeEmployees: 0, totalHoursToday: "0.0", pendingAlerts: 0 });
  }
});

// ==========================================
// 6. PERFIL Y SOLICITUDES (Las rutas que faltaban)
// ==========================================

// Cambiar Contraseña del empleado
app.post("/api/users/change-password", async (req, res) => {
  try {
    const { id, oldPassword, newPassword } = req.body;
    // Comprobamos que sabe su contraseña actual
    const { data: user } = await supabase.from('users').select('password').eq('id', id).single();
    
    if (!user || user.password !== oldPassword) {
      return res.status(400).json({ error: "La contraseña actual es incorrecta" });
    }
    
    // Guardamos la nueva
    const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Actualizar Perfil (Nombre y Departamento)
app.post("/api/users/update", async (req, res) => {
  try {
    const { id, name, department } = req.body;
    const { data, error } = await supabase.from('users').update({ name, department }).eq('id', id).select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leer Solicitudes Pendientes (Las "Alertas" de fuera de rango)
app.get("/api/admin/pending-records", async (req, res) => {
  try {
    // Traemos los fichajes que están a más de 100 metros para que el admin los revise
    const { data, error } = await supabase
      .from('fichajes')
      .select('*, users(name), sedes(nombre)')
      .gt('distancia_metros', 100)
      .order('fecha_hora', { ascending: false });
      
    if (error || !data) return res.json([]);

    const formateado = data.map(r => ({
      id: r.id,
      user_name: r.users?.name || 'Usuario desconocido',
      worksite_name: r.sedes?.nombre || 'Sede desconocida',
      type: r.tipo === 'Entrada Jornada' ? 'IN' : 'OUT',
      timestamp: r.fecha_hora,
      notes: r.notes || 'Fichaje fuera de rango',
      is_manual: false
    }));
    res.json(formateado);
  } catch (err) {
    res.json([]);
  }
});

// Aprobar/Rechazar un fichaje (Para que la alerta desaparezca)
app.post("/api/admin/records/approve", async (req, res) => {
  try {
    const { id, status } = req.body;
    if (status === 'REJECTED') {
      // Si el admin lo rechaza, lo borramos de la base de datos
      await supabase.from('fichajes').delete().eq('id', id);
    } else {
      // Si lo aprueba, le perdonamos la distancia poniéndola a 0 para que no salga más en alertas
      await supabase.from('fichajes').update({ distancia_metros: 0, notes: 'Aprobado por el Administrador' }).eq('id', id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. SALVAVIDAS FINAL Y EXPORTACIÓN
// ==========================================
app.use((req, res) => {
  if (req.method === 'GET') return res.json([]);
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

export default app;
  }
});

export default app;
