// Configuración de Supabase
// NOTA: Reemplaza estos valores con las credenciales de tu proyecto Supabase
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';

let supabaseClient = null;

// Inicializar el cliente de Supabase
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('El SDK de Supabase no se cargó correctamente. Asegúrate de incluir el script CDN en tu HTML.');
}

/**
 * Envía un ticket a la base de datos de Supabase.
 * @param {Object} ticketData - Los datos recolectados del formulario.
 * @returns {Promise<Object>} El ticket creado devuelto por la base de datos.
 */
async function enviarTicketASupabase(ticketData) {
    if (!supabaseClient) {
        throw new Error('Supabase no está inicializado. Por favor, configura tu URL y Anon Key.');
    }

    const { data, error } = await supabaseClient
        .from('tickets')
        .insert([
            {
                nombre: ticketData.nombre,
                email: ticketData.email,
                categoria: ticketData.categoria,
                prioridad: ticketData.prioridad,
                asunto: ticketData.asunto,
                descripcion: ticketData.descripcion,
                fecha_creacion: new Date().toISOString(),
                estado: 'abierto'
            }
        ])
        .select();

    if (error) {
        throw error;
    }

    return data[0];
}
