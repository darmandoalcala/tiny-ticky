document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const successMessage = document.getElementById('successMessage');
    const newTicketBtn = document.getElementById('newTicketBtn');
    const testTicketBtn = document.getElementById('testTicketBtn');
    const ticketHeader = document.querySelector('.ticket-header p');

    // Elementos de estado del perfil
    const nameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const statusContainer = document.getElementById('profileStatusContainer');
    const statusIcon = statusContainer ? statusContainer.querySelector('.profile-status-icon') : null;
    const statusMessage = document.getElementById('profileStatusMessage');

    // Elementos del Recibo Térmico
    const receiptImageContainer = document.getElementById('receiptImageContainer');
    const receiptImage = document.getElementById('receiptImage');
    const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');

    let debounceTimeout = null;
    let profileExists = false;
    let currentUserId = null;
    let isAutofilling = false;


    async function checkProfile() {
        if (!nameInput || !emailInput || !statusContainer) return;

        const nameVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();

        profileExists = false;
        currentUserId = null;

        const validEmail = validateEmail(emailVal);
        const validName = nameVal.length >= 3;
        if (!validName && !validEmail) {
            statusContainer.classList.add('hidden');
            return;
        }

        statusContainer.classList.remove('hidden', 'exists', 'new-profile');
        statusContainer.classList.add('searching');
        if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-loader-alt bx-spin';
        if (statusMessage) statusMessage.textContent = 'Buscando perfil de usuario...';

        try {
            const res = await searchProfileByNameOrEmail(nameVal || null, emailVal || null);

            if (res && res.profile) {
                profileExists = true;
                currentUserId = res.profile.id;
                statusContainer.classList.remove('searching', 'new-profile');
                statusContainer.classList.add('exists');
                if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-check';
                if (statusMessage) {
                    statusMessage.innerHTML = `¡Perfil encontrado! Vincularemos tu ticket al perfil de <strong>${res.profile.nombre_completo || nameVal}</strong> (${res.profile.correo || emailVal}).`;
                }

                // Autocompletado cruzado inteligente (Evita bucles infinitos con isAutofilling)
                isAutofilling = true;
                if (res.profile.nombre_completo && nameInput.value !== res.profile.nombre_completo) {
                    nameInput.value = res.profile.nombre_completo;
                }
                if (res.profile.correo && emailInput.value !== res.profile.correo) {
                    emailInput.value = res.profile.correo;
                }
                isAutofilling = false;
            } else {
                profileExists = false;
                currentUserId = null;
                statusContainer.classList.remove('searching', 'exists');
                statusContainer.classList.add('new-profile');
                if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-plus';
                if (statusMessage) {
                    statusMessage.innerHTML = `No se encontró un perfil existente. <strong>Se creará un nuevo perfil</strong> para ti al enviar el ticket.`;
                }
            }
        } catch (error) {
            console.error('Error al buscar perfil:', error);
            profileExists = false;
            currentUserId = null;
            statusContainer.classList.remove('searching', 'exists');
            statusContainer.classList.add('new-profile');
            if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-info-circle';
            if (statusMessage) {
                statusMessage.innerHTML = `No se pudo verificar el perfil. <strong>Se creará un nuevo perfil</strong> para ti al enviar el ticket.`;
            }
        }
    }

    let suggestionsTimeout = null;

    function handleInputModification(e) {
        if (isAutofilling) return;

        // Limpiar desplegables previos al escribir
        clearSuggestionsDropdown();

        if (profileExists) {
            // El usuario modificó un campo después de haber encontrado un perfil: limpiamos ambos campos
            isAutofilling = true;
            const targetInput = e.target;
            
            nameInput.value = "";
            emailInput.value = "";
            
            profileExists = false;
            currentUserId = null;
            
            if (statusContainer) {
                statusContainer.classList.add('hidden');
                statusContainer.classList.remove('exists', 'searching', 'new-profile');
            }
            
            isAutofilling = false;
            
            // Devolver el foco al campo que se modificó
            setTimeout(() => {
                targetInput.focus();
            }, 0);
            return;
        }

        // Búsqueda habitual si no hay perfil pre-cargado
        triggerDebounceCheck();

        // Obtener sugerencias en tiempo real
        const queryVal = e.target.value.trim();
        if (queryVal.length >= 2) {
            if (suggestionsTimeout) clearTimeout(suggestionsTimeout);
            suggestionsTimeout = setTimeout(async () => {
                if (typeof searchMatchingUsers === 'function') {
                    const matches = await searchMatchingUsers(queryVal);
                    showSuggestionsDropdown(e.target, matches);
                }
            }, 250);
        }
    }

    function showSuggestionsDropdown(inputElement, matches) {
        clearSuggestionsDropdown();
        if (!matches || matches.length === 0) return;

        const wrapper = inputElement.closest('.input-wrapper');
        if (!wrapper) return;

        const container = document.createElement('div');
        container.className = 'autocomplete-suggestions';

        matches.forEach(user => {
            const item = document.createElement('div');
            item.className = 'autocomplete-suggestion';
            item.innerHTML = `
                <span class="suggestion-name">${user.nombre_completo}</span>
                <span class="suggestion-email">${user.correo}</span>
            `;

            item.addEventListener('click', (clickEvent) => {
                clickEvent.stopPropagation(); // Prevenir cierre inmediato al hacer clic en la opción

                isAutofilling = true;
                nameInput.value = user.nombre_completo;
                emailInput.value = user.correo;
                isAutofilling = false;

                profileExists = true;
                currentUserId = user.id;

                if (statusContainer) {
                    statusContainer.classList.remove('hidden', 'searching', 'new-profile');
                    statusContainer.classList.add('exists');
                    if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-check';
                    if (statusMessage) {
                        statusMessage.innerHTML = `¡Perfil encontrado! Vincularemos tu ticket al perfil de <strong>${user.nombre_completo}</strong> (${user.correo}).`;
                    }
                }

                clearSuggestionsDropdown();
            });

            container.appendChild(item);
        });

        wrapper.appendChild(container);
    }

    function clearSuggestionsDropdown() {
        const existing = document.querySelectorAll('.autocomplete-suggestions');
        existing.forEach(el => el.parentNode.removeChild(el));
    }

    // Cerrar sugerencias si se hace clic fuera del wrapper del input
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.input-wrapper')) {
            clearSuggestionsDropdown();
        }
    });

    function triggerDebounceCheck() {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(checkProfile, 600);
    }

    // Registrar eventos para la búsqueda en tiempo real
    if (nameInput && emailInput) {
        nameInput.addEventListener('input', handleInputModification);
        emailInput.addEventListener('input', handleInputModification);
        nameInput.addEventListener('blur', checkProfile);
        emailInput.addEventListener('blur', checkProfile);
    }

    /**
     * Llena dinámicamente el recibo HTML y lo convierte en una imagen PNG usando canvas
     * @param {Object} ticketData - ticket data
     * @param {string} ticketId - ticket id
     */
    async function generateReceiptImage(ticketData, ticketId) {
        if (!receiptImageContainer || !receiptImage) return;

        // 1. Obtener fecha y hora actuales en formato de 24h
        const ahora = new Date();
        const fechaStr = ahora.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const horaStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        // 2. Mapear categorías a su etiqueta
        const catMap = {
            'equipo-computo': 'EQUIPO DE COMPUTO',
            'software': 'SOFTWARE / ACCESO',
            'internet': 'RED / INTERNET',
            'celular': 'TELEFONO / CELULAR',
            'cuenta': 'ACCESO / CUENTA',
            'impresora': 'IMPRESORA',
            'otro': 'OTRA CATEGORIA'
        };
        const catLabel = catMap[ticketData.categoria] || ticketData.categoria.toUpperCase();
        const agentName = (ticketData.asignado_a || 'AGENTE GENERAL').toUpperCase();
        
        // 4. Formatear y cortar descripción
        let descCorta = ticketData.descripcion;
        if (descCorta.length > 150) {
            descCorta = descCorta.substring(0, 147) + '...';
        }

        // 5. Construir la plantilla HTML dinámica del recibo
        const receiptHtml = `
            <div id="editableReceipt" class="receipt-paper">
                <div class="receipt-header">
                    <h2>ZENTH</h2>
                    <p>Equipo de TI</p>
                    <p>--------------------------------</p>
                </div>
                
                <div class="receipt-info">
                    <p>TICKET: <span>${ticketId}</span></p>
                    <p>FECHA: <span>${fechaStr}</span></p>
                    <p>HORA: <span>${horaStr}</span></p>
                    <p>ESTADO: ACTIVO / ABIERTO</p>
                    <p>--------------------------------</p>
                </div>
                
                <div class="receipt-customer">
                    <p>CLIENTE: <span>${ticketData.nombre.toUpperCase()}</span></p>
                    <p>EMAIL: <span>${ticketData.email.toUpperCase()}</span></p>
                    <p>--------------------------------</p>
                </div>
                
                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th>DESCRIPCION</th>
                            <th class="text-right">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>CATEGORIA: <span>${catLabel}</span></td>
                            <td class="text-right">OK</td>
                        </tr>
                        <tr>
                            <td>PRIORIDAD: <span>${ticketData.prioridad.toUpperCase()}</span></td>
                            <td class="text-right">!!</td>
                        </tr>
                        <tr>
                            <td colspan="2">ASUNTO: <span>${ticketData.asunto.toUpperCase()}</span></td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-desc-block">
                    <p>DETALLE:</p>
                    <p class="receipt-desc-text">${descCorta.toUpperCase()}</p>
                </div>
                
                <div class="receipt-divider"></div>
                
                <div class="receipt-footer">
                    <p>TICKET ASIGNADO A:</p>
                    <p class="receipt-agent-assigned"><strong>${agentName}</strong></p>
                    <p>*** GRACIAS POR REPORTAR ***</p>
                </div>
            </div>
        `;

        //Crear un contenedor temporal
        const tempContainer = document.createElement('div');
        tempContainer.className = 'receipt-offscreen';
        tempContainer.innerHTML = receiptHtml;
        document.body.appendChild(tempContainer);
        await document.fonts.ready;

        const editableReceipt = tempContainer.querySelector('#editableReceipt');
        if (editableReceipt) {
            try {
                const canvas = await html2canvas(editableReceipt, {
                    backgroundColor: null,
                    scale: 2, // Calidad x2 para la tipografía
                    logging: false,
                    useCORS: true
                });

                const imgData = canvas.toDataURL('image/png');
                
                // Cargar imagen en la vista del usuario
                receiptImage.src = imgData;
                receiptImageContainer.classList.remove('hidden');

                // 9. Configurar botón de descarga
                if (downloadReceiptBtn) {
                    const newDownloadBtn = downloadReceiptBtn.cloneNode(true);
                    downloadReceiptBtn.parentNode.replaceChild(newDownloadBtn, downloadReceiptBtn);
                    
                    newDownloadBtn.addEventListener('click', () => {
                        const link = document.createElement('a');
                        link.download = `recibo-${ticketId.toLowerCase()}.png`;
                        link.href = imgData;
                        link.click();
                    });
                }
            } catch (canvasError) {
                console.error('Error al generar la imagen del recibo:', canvasError);
            } finally {
                // 10. Limpiar el DOM eliminando el contenedor temporal offscreen
                if (tempContainer.parentNode) {
                    tempContainer.parentNode.removeChild(tempContainer);
                }
            }
        }
    }

    /**
     * Función para asignar al responsable del ticket.
     * 
     * @param {Object} ticketData - ticket data
     * @returns {Promise<void>}
     */
    async function asignarResponsableTicket(ticketData) {
        try {
            // Intentar obtener el agente dinámicamente desde Supabase usando la categoría
            if (typeof getAgentBySkill === 'function') {
                const agente = await getAgentBySkill(ticketData.categoria);
                if (agente && agente.nombre_completo) {
                    ticketData.agente_id = agente.id;
                    ticketData.asignado_a = agente.nombre_completo; // Para mostrar en el recibo
                    console.log(`Asignación Automática de Base de Datos: ${agente.nombre_completo} (Skill: ${ticketData.categoria})`);
                    return;
                }

                // Si no hay agente con la skill correspondiente, sortear entre los que tienen skill NULL
                if (typeof getAgentsWithNullSkill === 'function') {
                    const agentesComunes = await getAgentsWithNullSkill();
                    if (agentesComunes && agentesComunes.length > 0) {
                        const indiceAzar = Math.floor(Math.random() * agentesComunes.length);
                        const agenteSorteado = agentesComunes[indiceAzar];
                        
                        ticketData.agente_id = agenteSorteado.id;
                        ticketData.asignado_a = agenteSorteado.nombre_completo; // Para mostrar en el recibo
                        console.log(`Sorteo entre Agentes sin Skill (NULL): ${agenteSorteado.nombre_completo}`);
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudo consultar la asignación de agente en la base de datos:', e);
        }

        // Si no hay agentes o falla la asignación de base de datos, queda sin asignar
        ticketData.agente_id = null;
        ticketData.asignado_a = 'SIN ASIGNAR';
        console.log('El ticket se creará sin agente asignado.');
    }

    // Validación y subida
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        let isValid = true;

        // Quitar errores
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });

        // Validación básica
        const requiredFields = ['fullName', 'email', 'categoria', 'asunto', 'descripcion'];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            if (!field.value.trim()) {
                showError(field);
                isValid = false;
            } else if (field.type === 'email' && !validateEmail(field.value)) {
                showError(field);
                isValid = false;
            }
        });

        if (isValid) {
            const submitBtn = document.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>Enviando...</span>`;
            submitBtn.style.opacity = '0.8';
            submitBtn.disabled = true;

            // Recolectar datos para enviar a Supabase
            const ticketData = {
                nombre: document.getElementById('fullName').value.trim(),
                email: document.getElementById('email').value.trim(),
                categoria: document.getElementById('categoria').value,
                prioridad: document.getElementById('prioridad').value,
                asunto: document.getElementById('asunto').value.trim(),
                descripcion: document.getElementById('descripcion').value.trim()
            };

            try {
                // Buscar o crear el usuario en la base de datos para obtener el usuario_id
                if (!currentUserId) {
                    try {
                        const res = await searchProfileByNameOrEmail(ticketData.nombre, ticketData.email);
                        if (res && res.profile) {
                            currentUserId = res.profile.id;
                            profileExists = true;
                        } else {
                            const nuevoUsuario = await createProfileIfDoesNotExist(ticketData.nombre, ticketData.email);
                            if (nuevoUsuario && nuevoUsuario.id) {
                                currentUserId = nuevoUsuario.id;
                                profileExists = true;
                            }
                        }
                    } catch (profileError) {
                        console.warn('Error al verificar/crear el perfil del usuario:', profileError);
                    }
                }

                // Asignar el usuario_id obtenido a los datos del ticket
                ticketData.usuario_id = currentUserId;

                // Llamar a la función para asignar el responsable del ticket (vacía por el momento)
                await asignarResponsableTicket(ticketData);

                // Llamar al nuevo JS encargado de la comunicación con la base de datos
                const ticketCreado = await sendTicketToDB(ticketData);

                // Mostrar el ID del ticket insertado (usar ID asignado por la base de datos)
                const ticketIdParaMostrar = ticketCreado && ticketCreado.id ? `#TCK-${ticketCreado.id}` : `#TCK-${Math.floor(Math.random() * 9000) + 1000}`;
                document.getElementById('ticketId').textContent = ticketIdParaMostrar;

                // Ocultar formulario, mostrar pantalla de éxito
                form.style.display = 'none';
                if (ticketHeader) ticketHeader.style.display = 'none';
                if (statusContainer) statusContainer.classList.add('hidden');
                successMessage.classList.remove('hidden');

                // Generar dinámicamente la imagen del recibo
                await generateReceiptImage(ticketData, ticketIdParaMostrar);

                form.reset();
                if (fileNameDisplay) fileNameDisplay.classList.remove('active');
            } catch (error) {
                console.error('Error al enviar ticket a Supabase:', error);
                alert(`Error al enviar el ticket: ${error.message || error}`);
            } finally {
                // Restaurar estado del botón
                submitBtn.innerHTML = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
            }
        }
    });

    // DEBUG
    // ---- test sin enviar a DB ----
    if (testTicketBtn) {
        testTicketBtn.addEventListener('click', async function() {
            let isValid = true;

            // Resetear errores previos
            document.querySelectorAll('.form-group').forEach(group => {
                group.classList.remove('error');
            });

            // Validar los campos del formulario
            const requiredFields = ['fullName', 'email', 'categoria', 'asunto', 'descripcion'];
            
            requiredFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (!field) return;

                if (!field.value.trim()) {
                    showError(field);
                    isValid = false;
                } else if (field.type === 'email' && !validateEmail(field.value)) {
                    showError(field);
                    isValid = false;
                }
            });

            if (isValid) {
                const originalBtnText = testTicketBtn.innerHTML;
                testTicketBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>Generando Test...</span>`;
                testTicketBtn.style.opacity = '0.8';
                testTicketBtn.disabled = true;

                const ticketData = {
                    nombre: document.getElementById('fullName').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    categoria: document.getElementById('categoria').value,
                    prioridad: document.getElementById('prioridad').value,
                    asunto: document.getElementById('asunto').value.trim(),
                    descripcion: document.getElementById('descripcion').value.trim()
                };

                try {
                    // Llamar a la función de asignación para que también se pueda probar en previsualización
                    await asignarResponsableTicket(ticketData);

                    // Simular éxito
                    const ticketIdFalso = `#TCK-TEST-${Math.floor(Math.random() * 9000) + 1000}`;
                    document.getElementById('ticketId').textContent = ticketIdFalso;

                    // Ocultar formulario y mostrar pantalla de éxito
                    form.style.display = 'none';
                    if (ticketHeader) ticketHeader.style.display = 'none';
                    if (statusContainer) statusContainer.classList.add('hidden');
                    successMessage.classList.remove('hidden');

                    // Generar recibo de manera directa sin insertar en base de datos
                    await generateReceiptImage(ticketData, ticketIdFalso);

                    form.reset();
                    if (fileNameDisplay) fileNameDisplay.classList.remove('active');
                } catch (error) {
                    console.error('Error al previsualizar ticket:', error);
                    alert(`Error al generar la previsualización: ${error.message || error}`);
                } finally {
                    // Restaurar botón
                    testTicketBtn.innerHTML = originalBtnText;
                    testTicketBtn.style.opacity = '1';
                    testTicketBtn.disabled = false;
                }
            }
        });
    }

    function showError(element) {
        const group = element.closest('.form-group');
        if (!group) return;
        group.classList.add('error');
        
        // Remove error on input change
        element.addEventListener('input', function removeError() {
            group.classList.remove('error');
            element.removeEventListener('input', removeError);
        });
    }

    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    // Reset to create new ticket
    newTicketBtn.addEventListener('click', () => {
        successMessage.classList.add('hidden');
        form.style.display = 'flex';
        if (ticketHeader) ticketHeader.style.display = 'block';
        if (statusContainer) statusContainer.classList.add('hidden');
        if (receiptImageContainer) receiptImageContainer.classList.add('hidden');
        if (receiptImage) receiptImage.src = '';
        profileExists = false;
    });
});
