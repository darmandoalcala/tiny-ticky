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
                usuario_id: ticketData.usuario_id || null,
                asunto: ticketData.asunto,
                prioridad: ticketData.prioridad,
                cuerpo: ticketData.descripcion,
                estado: 'abierto',
                agente_id: ticketData.agente_id || null
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
    if (nombre) filters.push(`nombre_completo.eq.${nombre}`);
    if (email) filters.push(`correo.eq.${email}`);

    if (filters.length === 0) return null;

    const orFilter = filters.join(',');

    try {
        const { data, error } = await dbClient
            .from('usuarios')
            .select('*')
            .or(orFilter)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            return { profile: data[0], table: 'usuarios' };
        }
    } catch (e) {
        console.warn('Excepción al buscar en la tabla usuarios:', e);
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

    const usuarioData = {
        nombre_completo: nombre,
        correo: email
    };

    try {
        const { data, error } = await dbClient
            .from('usuarios')
            .insert([usuarioData])
            .select();
        
        if (!error && data && data.length > 0) {
            console.log('Usuario creado exitosamente en tabla usuarios.');
            return data[0];
        }
    } catch (e) {
        console.warn('Excepción al crear usuario en tabla usuarios:', e);
    }

    console.log('No se pudo crear un usuario en la tabla usuarios.');
    return null;
}

/**
 * Busca en la tabla 'agentes' un registro cuyo campo 'skill' coincida con la categoría dada.
 * @param {string} categoria - La categoría o skill a buscar.
 * @returns {Promise<Object|null>} El agente asignado o null.
 */
async function getAgentBySkill(categoria) {
    if (!dbClient) {
        // Si aún está cargando la API asíncrona, esperar un instante
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!dbClient) return null;
    }

    try {
        const { data, error } = await dbClient
            .from('agentes')
            .select('*')
            .eq('skill', categoria)
            .limit(1);

        if (error) {
            console.warn('Error al buscar agente por skill:', error);
            return null;
        }

        if (data && data.length > 0) {
            return data[0];
        }
    } catch (e) {
        console.warn('Excepción al buscar agente por skill:', e);
    }
    return null;
}

/**
 * Busca en la tabla 'agentes' todos los registros cuyo campo 'skill' sea NULL.
 * @returns {Promise<Array>} Lista de agentes con skill nula.
 */
async function getAgentsWithNullSkill() {
    if (!dbClient) {
        // Si aún está cargando la API asíncrona, esperar un instante
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!dbClient) return [];
    }

    try {
        const { data, error } = await dbClient
            .from('agentes')
            .select('*')
            .is('skill', null);

        if (error) {
            console.warn('Error al buscar agentes con skill nula:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.warn('Excepción al buscar agentes con skill nula:', e);
    }
    return [];
}

/**
 * Busca hasta 5 usuarios cuyo nombre o correo contengan la consulta indicada.
 * @param {string} query - El término de búsqueda.
 * @returns {Promise<Array>} Lista de coincidencias.
 */
async function searchMatchingUsers(query) {
    if (!dbClient) {
        // Si aún está cargando la API asíncrona, esperar un instante
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!dbClient) return [];
    }
    if (!query || query.length < 2) return [];

    try {
        const { data, error } = await dbClient
            .from('usuarios')
            .select('id, nombre_completo, correo')
            .or(`nombre_completo.ilike.%${query}%,correo.ilike.%${query}%`)
            .limit(5);

        if (error) {
            console.warn('Error al buscar sugerencias de usuarios:', error);
            return [];
        }

        return data || [];
    } catch (e) {
        console.warn('Excepción al buscar sugerencias de usuarios:', e);
    }
    return [];
}
