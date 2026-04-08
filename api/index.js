import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Forzamos la lectura limpia de variables
const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

app.get("/api/worksites", async (req, res) => {
  try {
    // Si la URL es inválida, este fetch fallará con el error que viste
    const { data, error } = await supabase.from('sedes').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ 
      error: "Error de conexión", 
      detalle: err.message,
      config_ok: !!supabaseUrl && !!supabaseKey 
    });
  }
});

// ... (mantén tu ruta de login igual)

export default app;

// Ruta de Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// En modo "module", se usa export default en lugar de module.exports
export default app;
