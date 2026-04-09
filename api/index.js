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
// 3. SEDES (CRUD Completo)
// ==========================================
app.get(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  const { data, error } = await supabase.from('sedes').select('*');
  res.json(error ? [] : data);
});

// ==========================================
// CREAR SEDE (Con Traductor Automático)
// ==========================================
app.post(["/api/worksites", "/api/admin/worksites"], async (req, res) => {
  try {
    // TRADUCTOR: El frontend nos manda inglés, nosotros lo pasamos al español que espera Supabase
    const sedeTraducida = {
      nombre: req.body.name,
      latitud: req.body.latitude,
      longitud: req.body.longitude
      // Nota: Omitimos 'address' y 'radius' intencionadamente para que Supabase no dé error si no existen esas columnas
    };

    const { data, error } = await supabase
      .from('sedes')
      .insert([sedeTraducida])
      .select();

    if (error) {
      console.log("❌ ERROR SUPABASE:", error.message);
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('sedes').update(req.body).eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
});

app.delete(["/api/worksites/:id", "/api/admin/worksites/:id"], async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('sedes').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

// ==========================================
// 4. FICHAJES Y ESTADO (Para gráficos)
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
