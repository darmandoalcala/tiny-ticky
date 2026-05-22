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

/**
 * Busca un perfil por nombre o correo en la base de datos de Supabase.
 * Realiza una consulta en cascada en las tablas 'perfiles' -> 'profiles' -> 'tickets'.
 * @param {string} nombre - El nombre a buscar.
 * @param {string} email - El correo a buscar.
 * @returns {Promise<Object|null>} El perfil encontrado con la tabla origen, o null.
 */
async function buscarPerfilPorNombreOCorreo(nombre, email) {
    if (!supabaseClient) {
        throw new Error('Supabase no está inicializado.');
    }

    const filters = [];
    if (nombre) filters.push(`nombre.eq.${nombre}`);
    if (email) filters.push(`email.eq.${email}`);

    if (filters.length === 0) return null;

    const orFilter = filters.join(',');

    // 1. Intentar con la tabla 'perfiles'
    try {
        const { data, error } = await supabaseClient
            .from('perfiles')
            .select('*')
            .or(orFilter)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { profile: data[0], table: 'perfiles' };
        }
        if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.perfiles" does not exist')) {
            console.warn('Error al buscar en perfiles, intentando fallback...', error);
        }
    } catch (e) {
        console.warn('Excepción al buscar en perfiles:', e);
    }

    // 2. Fallback: Intentar con la tabla 'profiles'
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .or(orFilter)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { profile: data[0], table: 'profiles' };
        }
        if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.profiles" does not exist')) {
            console.warn('Error al buscar en profiles, intentando fallback...', error);
        }
    } catch (e) {
        console.warn('Excepción al buscar en profiles:', e);
    }

    // 3. Fallback: Intentar con la tabla 'tickets' (para ver si ya han enviado tickets antes)
    try {
        const { data, error } = await supabaseClient
            .from('tickets')
            .select('*')
            .or(orFilter)
            .order('fecha_creacion', { ascending: false })
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { 
                profile: { 
                    nombre: data[0].nombre, 
                    email: data[0].email 
                }, 
                table: 'tickets' 
            };
        }
    } catch (e) {
        console.warn('Excepción al buscar en tickets:', e);
    }

    return null;
}

/**
 * Crea un perfil de usuario si no existe en la base de datos de Supabase.
 * @param {string} nombre - Nombre del usuario.
 * @param {string} email - Correo del usuario.
 * @returns {Promise<Object|null>} El perfil creado o null si no se pudo crear.
 */
async function crearPerfilSiNoExiste(nombre, email) {
    if (!supabaseClient) return null;

    const perfilData = {
        nombre: nombre,
        email: email,
        fecha_creacion: new Date().toISOString()
    };

    // 1. Intentar insertar en 'perfiles'
    try {
        const { data, error } = await supabaseClient
            .from('perfiles')
            .insert([perfilData])
            .select();
        
        if (!error && data && data.length > 0) {
            console.log('Perfil creado exitosamente en tabla perfiles.');
            return data[0];
        }
    } catch (e) {
        console.warn('Excepción al crear perfil en tabla perfiles:', e);
    }

    // 2. Fallback: Intentar insertar en 'profiles'
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .insert([perfilData])
            .select();
        
        if (!error && data && data.length > 0) {
            console.log('Perfil creado exitosamente en tabla profiles.');
            return data[0];
        }
    } catch (e) {
        console.warn('Excepción al crear perfil en tabla profiles:', e);
    }

    console.log('No se pudo crear un perfil en las tablas perfiles/profiles (posiblemente no existen aún). El ticket se guardará directamente.');
    return null;
}
