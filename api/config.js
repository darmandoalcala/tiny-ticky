// Controlador Serverless para Vercel (100% genérico y seguro para subir a GitHub público)
// NOTA: No contiene claves hardcodeadas. Lee las credenciales de forma dinámica desde
// las variables de entorno de tu Dashboard de Vercel (DATABASE_URL y DATABASE_ANON_KEY).
export default function handler(req, res) {
  res.status(200).json({
    url: process.env.DATABASE_URL || process.env.SUPABASE_URL || "",
    anonKey: process.env.DATABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
  });
}