// Configuración de la base de datos
// NOTA: Para producción y desarrollo, las credenciales se cargan de forma dinámica desde el
// endpoint serverless de Vercel (el cual lee de forma segura tu archivo .env local en "vercel dev" 
// o bien del Dashboard de Vercel en producción).

let DB_URL = null;
let DB_ANON_KEY = null;
let dbClient = null;

// Inicializar el cliente de la base de datos de manera asíncrona
async function inicializarBaseDeDatos() {
    // 0. Intentar cargar desde variables globales síncronas (desarrollo local vía env.js)
    if (typeof window !== 'undefined' && window.env && window.env.DATABASE_URL && window.env.DATABASE_ANON_KEY) {
        let cleanUrl = window.env.DATABASE_URL.trim();
        if (cleanUrl.endsWith('/rest/v1/')) {
            cleanUrl = cleanUrl.slice(0, -9);
        } else if (cleanUrl.endsWith('/rest/v1')) {
            cleanUrl = cleanUrl.slice(0, -8);
        }
        
        DB_URL = cleanUrl;
        DB_ANON_KEY = window.env.DATABASE_ANON_KEY;
        
        if (typeof supabase !== 'undefined') {
            dbClient = supabase.createClient(DB_URL, DB_ANON_KEY);
            console.log('Cliente de base de datos inicializado desde env.js local.');
            return;
        }
    }

    // 1. Intentar cargar desde el endpoint serverless `/api/config` (Producción en Vercel o local con vercel dev)
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            if (config.url && config.anonKey) {
                // Sanitizar la URL para prevenir errores del SDK si el usuario configuró el sufijo /rest/v1
                let cleanUrl = config.url.trim();
                if (cleanUrl.endsWith('/rest/v1/')) {
                    cleanUrl = cleanUrl.slice(0, -9);
                } else if (cleanUrl.endsWith('/rest/v1')) {
                    cleanUrl = cleanUrl.slice(0, -8);
                }
                
                DB_URL = cleanUrl;
                DB_ANON_KEY = config.anonKey;
                
                if (typeof supabase !== 'undefined') {
                    dbClient = supabase.createClient(DB_URL, DB_ANON_KEY);
                    console.log('Cliente de base de datos inicializado mediante API serverless.');
                    return;
                }
            }
        }
    } catch (e) {
        console.warn('El endpoint serverless /api/config no está disponible. Intentando lectura estática de fallback...');
    }

    // 2. Fallback Hacker: Intentar leer api/config.js de manera estática y parsear sus constantes con Regex (Desarrollo offline sin servidor backend)
    try {
        const response = await fetch('api/config.js');
        if (response.ok) {
            const text = await response.text();
            const urlMatch = text.match(/SUPABASE_URL\s*=\s*["']([^"']+)["']/);
            const keyMatch = text.match(/SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/);
            
            if (urlMatch && keyMatch) {
                let cleanUrl = urlMatch[1].trim();
                // Sanitizar sufijo si existe
                if (cleanUrl.endsWith('/rest/v1/')) {
                    cleanUrl = cleanUrl.slice(0, -9);
                } else if (cleanUrl.endsWith('/rest/v1')) {
                    cleanUrl = cleanUrl.slice(0, -8);
                }

                DB_URL = cleanUrl;
                DB_ANON_KEY = keyMatch[1];

                if (typeof supabase !== 'undefined') {
                    dbClient = supabase.createClient(DB_URL, DB_ANON_KEY);
                    console.log('Cliente de base de datos inicializado con éxito parseando api/config.js localmente.');
                    return;
                }
            }
        }
    } catch (staticErr) {
        console.warn('No se pudo acceder a api/config.js de forma estática.');
    }

    // Advertencia si no se logró conectar
    if (typeof supabase === 'undefined') {
        console.error('El SDK de la base de datos no se cargó correctamente. Asegúrate de incluir el script CDN en tu HTML.');
    } else if (!dbClient) {
        console.warn('Base de datos sin inicializar. Asegúrate de configurar tus credenciales en api/config.js o env.js.');
    }
}

// Iniciar proceso de conexión
inicializarBaseDeDatos();

/**
 * Envía un ticket a la base de datos.
 * @param {Object} ticketData - Los datos recolectados del formulario.
 * @returns {Promise<Object>} El ticket creado devuelto por la base de datos.
 */
async function sendTicketToDB(ticketData) {
    if (!dbClient) {
        // Si aún está cargando la API asíncrona, esperar un instante
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!dbClient) {
            throw new Error('La base de datos no está inicializada. Por favor, configura tu URL y Anon Key.');
        }
    }

    const { data, error } = await dbClient
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
 * Busca un perfil por nombre o correo en la base de datos.
 * Realiza una consulta en cascada en las tablas 'perfiles' -> 'profiles' -> 'tickets'.
 * @param {string} nombre - El nombre a buscar.
 * @param {string} email - El correo a buscar.
 * @returns {Promise<Object|null>} El perfil encontrado con la tabla origen, o null.
 */
async function searchProfileByNameOrEmail(nombre, email) {
    if (!dbClient) {
        // Esperar brevemente por si se está inicializando
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!dbClient) {
            throw new Error('La base de datos no está inicializada.');
        }
    }

    const filters = [];
    if (nombre) filters.push(`nombre.eq.${nombre}`);
    if (email) filters.push(`email.eq.${email}`);

    if (filters.length === 0) return null;

    const orFilter = filters.join(',');

    // 1. Intentar con la tabla 'perfiles'
    try {
        const { data, error } = await dbClient
            .from('perfiles')
            .select('*')
            .or(orFilter)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { profile: data[0], table: 'perfiles' };
        }
        if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.perfiles" does not exist')) {
            console.warn('Error al buscar en la tabla perfiles, intentando con profiles...', error);
        }
    } catch (e) {
        console.warn('Excepción al buscar en perfiles:', e);
    }

    // 2. Fallback: Intentar con la tabla 'profiles'
    try {
        const { data, error } = await dbClient
            .from('profiles')
            .select('*')
            .or(orFilter)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { profile: data[0], table: 'profiles' };
        }
        if (error && error.code !== 'PGRST116' && !error.message.includes('relation "public.profiles" does not exist')) {
            console.warn('Error al buscar en la tabla profiles, intentando con tickets...', error);
        }
    } catch (e) {
        console.warn('Excepción al buscar en profiles:', e);
    }

    // 3. Fallback: Intentar con la tabla 'tickets' (para ver si ya han enviado tickets antes)
    try {
        const { data, error } = await dbClient
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
        console.warn('Excepción al buscar en la tabla tickets:', e);
    }

    return null;
}

/**
 * Crea un perfil de usuario si no existe en la base de datos.
 * @param {string} nombre - Nombre del usuario.
 * @param {string} email - Correo del usuario.
 * @returns {Promise<Object|null>} El perfil creado o null si no se pudo crear.
 */
async function createProfileIfDoesNotExist(nombre, email) {
    if (!dbClient) return null;

    const perfilData = {
        nombre: nombre,
        email: email,
        fecha_creacion: new Date().toISOString()
    };

    // 1. Intentar insertar en 'perfiles'
    try {
        const { data, error } = await dbClient
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
        const { data, error } = await dbClient
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
