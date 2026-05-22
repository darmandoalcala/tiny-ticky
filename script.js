document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const fileInput = document.getElementById('attachment');
    const fileUploadBox = document.querySelector('.file-upload-box');
    const fileNameDisplay = document.getElementById('fileName');
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

    // Drag and drop functionality for file upload (only active if components exist in HTML)
    if (fileUploadBox && fileInput && fileNameDisplay) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileUploadBox.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            fileUploadBox.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileUploadBox.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            fileUploadBox.classList.add('dragover');
        }

        function unhighlight(e) {
            fileUploadBox.classList.remove('dragover');
        }

        fileUploadBox.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            let dt = e.dataTransfer;
            let files = dt.files;
            
            if (files.length > 0) {
                fileInput.files = files;
                updateFileName(files[0].name);
            }
        }

        // File input change handler
        fileInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                updateFileName(this.files[0].name);
            } else {
                fileNameDisplay.classList.remove('active');
            }
        });

        function updateFileName(name) {
            fileNameDisplay.innerHTML = `<i class='bx bx-file'></i> ${name}`;
            fileNameDisplay.classList.add('active');
        }
    }

    // Lógica para verificar el perfil del usuario de forma dinámica
    async function chequearPerfil() {
        if (!nameInput || !emailInput || !statusContainer) return;

        const nombreVal = nameInput.value.trim();
        const emailVal = emailInput.value.trim();

        // Limpiar el estado de existencia previo
        profileExists = false;

        const esEmailValido = validateEmail(emailVal);
        const tieneNombreValido = nombreVal.length >= 3;

        // Si no hay suficiente información, ocultamos el contenedor
        if (!tieneNombreValido && !esEmailValido) {
            statusContainer.classList.add('hidden');
            return;
        }

        // Mostrar estado de carga
        statusContainer.classList.remove('hidden', 'exists', 'new-profile');
        statusContainer.classList.add('searching');
        if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-loader-alt bx-spin';
        if (statusMessage) statusMessage.textContent = 'Buscando perfil de usuario...';

        try {
            const res = await buscarPerfilPorNombreOCorreo(nombreVal || null, emailVal || null);

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
            // Fallback gracioso ante problemas de conexión o base de datos no configurada aún
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
        debounceTimeout = setTimeout(chequearPerfil, 600);
    }

    // Registrar eventos para la búsqueda en tiempo real
    if (nameInput && emailInput) {
        nameInput.addEventListener('input', triggerDebounceCheck);
        emailInput.addEventListener('input', triggerDebounceCheck);
        nameInput.addEventListener('blur', chequearPerfil);
        emailInput.addEventListener('blur', chequearPerfil);
    }

    /**
     * Llena dinámicamente el recibo HTML y lo convierte en una imagen PNG usando html2canvas.
     * @param {Object} ticketData - Los datos del ticket.
     * @param {string} ticketId - El identificador del ticket (ej: #TCK-1234).
     */
    async function generarReciboImagen(ticketData, ticketId) {
        if (!receiptImageContainer || !receiptImage) return;

        // 1. Rellenar los valores en el HTML editable
        const idValElement = document.getElementById('receiptIdVal');
        if (idValElement) idValElement.textContent = ticketId;
        
        // Obtener fecha y hora actuales en formato mexicano (24h)
        const ahora = new Date();
        const fechaStr = ahora.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const horaStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
        
        const dateValElement = document.getElementById('receiptDateVal');
        const timeValElement = document.getElementById('receiptTimeVal');
        if (dateValElement) dateValElement.textContent = fechaStr;
        if (timeValElement) timeValElement.textContent = horaStr;
        
        const nameValElement = document.getElementById('receiptNameVal');
        const emailValElement = document.getElementById('receiptEmailVal');
        if (nameValElement) nameValElement.textContent = ticketData.nombre.toUpperCase();
        if (emailValElement) emailValElement.textContent = ticketData.email.toUpperCase();
        
        // Mapear categorías a su etiqueta en el recibo
        const catMap = {
            'equipo-computo': 'EQUIPO DE COMPUTO',
            'software': 'SOFTWARE / ACCESO',
            'internet': 'RED / INTERNET',
            'celular': 'TELEFONIA / MOVIL',
            'cuenta': 'ACCESO / CUENTA',
            'otro': 'OTRA CATEGORIA'
        };
        const catLabel = catMap[ticketData.categoria] || ticketData.categoria.toUpperCase();
        
        const catValElement = document.getElementById('receiptCategoryVal');
        const prioValElement = document.getElementById('receiptPriorityVal');
        const subValElement = document.getElementById('receiptSubjectVal');
        if (catValElement) catValElement.textContent = catLabel;
        if (prioValElement) prioValElement.textContent = ticketData.prioridad.toUpperCase();
        if (subValElement) subValElement.textContent = ticketData.asunto.toUpperCase();
        
        // Formatear y cortar descripción
        let descCorta = ticketData.descripcion;
        if (descCorta.length > 150) {
            descCorta = descCorta.substring(0, 147) + '...';
        }
        const descValElement = document.getElementById('receiptDescVal');
        if (descValElement) descValElement.textContent = descCorta.toUpperCase();
        
        // Código de barras simulado
        const barcodeNum = ticketId.replace('#', '') + '-' + Math.floor(Math.random() * 90000 + 10000);
        const barcodeElement = document.getElementById('receiptBarcodeNum');
        if (barcodeElement) barcodeElement.textContent = barcodeNum;

        // 2. Esperar a que las fuentes se carguen correctamente
        await document.fonts.ready;

        // 3. Renderizar el elemento #editableReceipt a imagen usando html2canvas
        const editableReceipt = document.getElementById('editableReceipt');
        if (editableReceipt) {
            try {
                const canvas = await html2canvas(editableReceipt, {
                    backgroundColor: null,
                    scale: 2, // Escala 2x para un renderizado HD super nítido de la tipografía VT323
                    logging: false,
                    useCORS: true
                });

                const imgData = canvas.toDataURL('image/png');
                
                // Mostrar la imagen en el contenedor de éxito
                receiptImage.src = imgData;
                receiptImageContainer.classList.remove('hidden');

                // 4. Configurar el botón de descarga del PNG
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
            }
        }
    }

    // Form Validation and Submission
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        let isValid = true;

        // Reset previous errors
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });

        // Basic validation using correct Spanish IDs from index.html
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
                        await crearPerfilSiNoExiste(ticketData.nombre, ticketData.email);
                        profileExists = true;
                    } catch (profileError) {
                        console.warn('No se pudo crear el perfil, continuando con el ticket:', profileError);
                    }
                }

                // Llamar al nuevo JS encargado de la comunicación con Supabase
                const ticketCreado = await enviarTicketASupabase(ticketData);

                // Mostrar el ID del ticket insertado (usar ID asignado por Supabase o autogenerado si no viene)
                const ticketIdParaMostrar = ticketCreado && ticketCreado.id ? `#TCK-${ticketCreado.id}` : `#TCK-${Math.floor(Math.random() * 9000) + 1000}`;
                document.getElementById('ticketId').textContent = ticketIdParaMostrar;

                // Ocultar formulario, mostrar pantalla de éxito
                form.style.display = 'none';
                if (ticketHeader) ticketHeader.style.display = 'none';
                if (statusContainer) statusContainer.classList.add('hidden');
                successMessage.classList.remove('hidden');

                // Generar dinámicamente la imagen del recibo retro de supermercado
                await generarReciboImagen(ticketData, ticketIdParaMostrar);

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

    // Lógica para testear y previsualizar el recibo sin enviar a Supabase
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
                    // Simular éxito y número de ticket
                    const ticketIdFalso = `#TCK-TEST-${Math.floor(Math.random() * 9000) + 1000}`;
                    document.getElementById('ticketId').textContent = ticketIdFalso;

                    // Ocultar formulario, mostrar pantalla de éxito
                    form.style.display = 'none';
                    if (ticketHeader) ticketHeader.style.display = 'none';
                    if (statusContainer) statusContainer.classList.add('hidden');
                    successMessage.classList.remove('hidden');

                    // Generar recibo de manera directa sin insertar en base de datos
                    await generarReciboImagen(ticketData, ticketIdFalso);

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
