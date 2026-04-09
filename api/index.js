import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Conexión segura
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Ruta de Login blindada
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscamos al usuario sin usar .single() que a veces causa colapsos
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password);

    // Si Supabase se queja de algo técnico
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Si la lista de usuarios está vacía (email o pass incorrecto)
    if (!data || data.length === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // Si todo va bien, sacamos al usuario, le quitamos la contraseña y lo enviamos
    const user = data[0];
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
    
  } catch (err) {
    // Solo si el servidor se incendia
    res.status(500).json({ error: "Error interno", detalle: err.message });
  }
});

// Ruta de prueba
app.get("/api/worksites", async (req, res) => {
  const { data, error } = await supabase.from('sedes').select('*');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});
// Ruta para CREAR una nueva sede (Ajustada para coincidir con React)
app.post("/api/admin/worksites", async (req, res) => {
  try {
    const nuevaSede = req.body;
    
    const { data, error } = await supabase
      .from('sedes')
      .insert([nuevaSede])
      .select();

    if (error) {
      console.error("Error de Supabase al insertar sede:", error.message);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: "Error interno del servidor", detalle: err.message });
  }
});
export default app;
