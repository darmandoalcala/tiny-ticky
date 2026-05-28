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


    async function checkProfile() {
        if (!nameInput || !emailInput || !statusContainer) return;

        const nameVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();

        profileExists = false;

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
                statusContainer.classList.remove('searching', 'new-profile');
                statusContainer.classList.add('exists');
                if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-check';
                if (statusMessage) {
                    statusMessage.innerHTML = `¡Perfil encontrado! Vincularemos tu ticket al perfil de <strong>${res.profile.nombre || nombreVal}</strong> (${res.profile.email || emailVal}).`;
                }
            } else {
                profileExists = false;
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
            statusContainer.classList.remove('searching', 'exists');
            statusContainer.classList.add('new-profile');
            if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-info-circle';
            if (statusMessage) {
                statusMessage.innerHTML = `No se pudo verificar el perfil. <strong>Se creará un nuevo perfil</strong> para ti al enviar el ticket.`;
            }
        }
    }

    function triggerDebounceCheck() {
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        debounceTimeout = setTimeout(checkProfile, 600);
    }

    // Registrar eventos para la búsqueda en tiempo real
    if (nameInput && emailInput) {
        nameInput.addEventListener('input', triggerDebounceCheck);
        emailInput.addEventListener('input', triggerDebounceCheck);
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
        
        const agentMap = {
            'equipo-computo': 'CARLOS RUIZ (HARDWARE)',
            'software': 'SOFIA MORALES (SOFTWARE)',
            'internet': 'JORGE GOMEZ (REDES)',
            'celular': 'DIANA PEREZ (MOVIL)',
            'cuenta': 'MIGUEL ANGEL (ACCESOS)',
            'otro': 'AGENTE GENERAL'
        };
        const agentName = agentMap[ticketData.categoria] || 'AGENTE GENERAL';
        
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
                // Si el perfil no existe, crearlo antes de enviar el ticket
                if (!profileExists) {
                    try {
                        await createProfileIfDoesNotExist(ticketData.nombre, ticketData.email);
                        profileExists = true;
                    } catch (profileError) {
                        console.warn('No se pudo crear el perfil, continuando con el ticket:', profileError);
                    }
                }

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
