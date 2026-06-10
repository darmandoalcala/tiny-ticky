document.addEventListener('DOMContentLoaded', () => {
    // ====================================================================
    //  UTILIDADES COMPARTIDAS
    // ====================================================================
    function showError(element) {
        const group = element.closest('.form-group');
        if (!group) return;
        group.classList.add('error');
        element.addEventListener('input', function removeError() {
            group.classList.remove('error');
            element.removeEventListener('input', removeError);
        });
    }

    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.​[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
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

    function setupProfileSearch(config) {
        const {
            nameInput,
            emailInput,
            statusContainer,
            statusMessage: statusMsgEl,
        } = config;

        const statusIcon = statusContainer ? statusContainer.querySelector('.profile-status-icon') : null;

        // Estado independiente para este par de campos
        const state = {
            profileExists: false,
            currentUserId: null,
            isAutofilling: false,
            debounceTimeout: null,
            suggestionsTimeout: null,
        };

        async function checkProfile() {
            if (!nameInput || !emailInput || !statusContainer) return;

            const nameVal = nameInput.value.trim();
            const emailVal = emailInput.value.trim();

            state.profileExists = false;
            state.currentUserId = null;

            const validEmail = validateEmail(emailVal);
            const validName = nameVal.length >= 3;
            if (!validName && !validEmail) {
                statusContainer.classList.add('hidden');
                return;
            }

            statusContainer.classList.remove('hidden', 'exists', 'new-profile');
            statusContainer.classList.add('searching');
            if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-loader-alt bx-spin';
            if (statusMsgEl) statusMsgEl.textContent = 'Buscando perfil de usuario...';

            try {
                const res = await searchProfileByNameOrEmail(nameVal || null, emailVal || null);

                if (res && res.profile) {
                    state.profileExists = true;
                    state.currentUserId = res.profile.id;
                    statusContainer.classList.remove('searching', 'new-profile');
                    statusContainer.classList.add('exists');
                    if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-check';
                    if (statusMsgEl) {
                        statusMsgEl.innerHTML = `¡Perfil encontrado! Vincularemos tu ticket al perfil de <strong>${res.profile.nombre_completo || nameVal}</strong> (${res.profile.correo || emailVal}).`;
                    }

                    state.isAutofilling = true;
                    if (res.profile.nombre_completo && nameInput.value !== res.profile.nombre_completo) {
                        nameInput.value = res.profile.nombre_completo;
                    }
                    if (res.profile.correo && emailInput.value !== res.profile.correo) {
                        emailInput.value = res.profile.correo;
                    }
                    state.isAutofilling = false;
                } else {
                    state.profileExists = false;
                    state.currentUserId = null;
                    statusContainer.classList.remove('searching', 'exists');
                    statusContainer.classList.add('new-profile');
                    if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-plus';
                    if (statusMsgEl) {
                        statusMsgEl.innerHTML = `No se encontró un perfil existente. <strong>Se creará un nuevo perfil</strong> para ti al enviar el ticket.`;
                    }
                }
            } catch (error) {
                console.error('Error al buscar perfil:', error);
                state.profileExists = false;
                state.currentUserId = null;
                statusContainer.classList.remove('searching', 'exists');
                statusContainer.classList.add('new-profile');
                if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-info-circle';
                if (statusMsgEl) {
                    statusMsgEl.innerHTML = `No se pudo verificar el perfil. <strong>Se creará un nuevo perfil</strong> para ti al enviar el ticket.`;
                }
            }
        }

        function triggerDebounceCheck() {
            if (state.debounceTimeout) clearTimeout(state.debounceTimeout);
            state.debounceTimeout = setTimeout(checkProfile, 600);
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
                    clickEvent.stopPropagation();

                    state.isAutofilling = true;
                    nameInput.value = user.nombre_completo;
                    emailInput.value = user.correo;
                    state.isAutofilling = false;

                    state.profileExists = true;
                    state.currentUserId = user.id;

                    if (statusContainer) {
                        statusContainer.classList.remove('hidden', 'searching', 'new-profile');
                        statusContainer.classList.add('exists');
                        if (statusIcon) statusIcon.className = 'profile-status-icon bx bx-user-check';
                        if (statusMsgEl) {
                            statusMsgEl.innerHTML = `¡Perfil encontrado! Vincularemos tu ticket al perfil de <strong>${user.nombre_completo}</strong> (${user.correo}).`;
                        }
                    }

                    clearSuggestionsDropdown();
                });

                container.appendChild(item);
            });

            wrapper.appendChild(container);
        }

        function handleInputModification(e) {
            if (state.isAutofilling) return;

            clearSuggestionsDropdown();

            if (state.profileExists) {
                state.isAutofilling = true;
                const targetInput = e.target;

                nameInput.value = "";
                emailInput.value = "";

                state.profileExists = false;
                state.currentUserId = null;

                if (statusContainer) {
                    statusContainer.classList.add('hidden');
                    statusContainer.classList.remove('exists', 'searching', 'new-profile');
                }

                state.isAutofilling = false;

                setTimeout(() => { targetInput.focus(); }, 0);
                return;
            }

            triggerDebounceCheck();

            const queryVal = e.target.value.trim();
            if (queryVal.length >= 2) {
                if (state.suggestionsTimeout) clearTimeout(state.suggestionsTimeout);
                state.suggestionsTimeout = setTimeout(async () => {
                    if (typeof searchMatchingUsers === 'function') {
                        const matches = await searchMatchingUsers(queryVal);
                        showSuggestionsDropdown(e.target, matches);
                    }
                }, 250);
            }
        }

        // Registrar eventos
        if (nameInput && emailInput) {
            nameInput.addEventListener('input', handleInputModification);
            emailInput.addEventListener('input', handleInputModification);
            nameInput.addEventListener('blur', checkProfile);
            emailInput.addEventListener('blur', checkProfile);
        }

        return state;
    }

    // ====================================================================
    //  TAB: SOPORTE
    // ====================================================================
    const form = document.getElementById('ticketForm');
    const successMessage = document.getElementById('successMessage');
    const newTicketBtn = document.getElementById('newTicketBtn');
    const testTicketBtn = document.getElementById('testTicketBtn');
    const ticketHeader = document.querySelector('#panelSoporte .ticket-header p');

    const nameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const statusContainer = document.getElementById('profileStatusContainer');
    const statusMessage = document.getElementById('profileStatusMessage');

    const receiptImageContainer = document.getElementById('receiptImageContainer');
    const receiptImage = document.getElementById('receiptImage');
    const downloadReceiptBtn = document.getElementById('downloadReceiptBtn');

    // Configurar búsqueda de perfil para Soporte
    const soporteProfileState = setupProfileSearch({
        nameInput,
        emailInput,
        statusContainer,
        statusMessage,
    });

    // ====================================================================
    //  TAB: FACILITIES — Configurar búsqueda de perfil
    // ====================================================================
    const facNameInput = document.getElementById('facFullName');
    const facEmailInput = document.getElementById('facEmail');
    const facStatusContainer = document.getElementById('facProfileStatusContainer');
    const facStatusMessage = document.getElementById('facProfileStatusMessage');

    const facProfileState = setupProfileSearch({
        nameInput: facNameInput,
        emailInput: facEmailInput,
        statusContainer: facStatusContainer,
        statusMessage: facStatusMessage,
    });

    // ====================================================================
    //  RECIBO TÉRMICO (solo Soporte por ahora)
    // ====================================================================
    async function generateReceiptImage(ticketData, ticketId) {
        if (!receiptImageContainer || !receiptImage) return;

        const ahora = new Date();
        const fechaStr = ahora.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const horaStr = ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

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

        let descCorta = ticketData.descripcion;
        if (descCorta.length > 150) {
            descCorta = descCorta.substring(0, 147) + '...';
        }

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
                    <p>SUCURSAL: <span>${(ticketData.sucursal || 'N/A').toUpperCase()}</span></p>
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
                    scale: 2,
                    logging: false,
                    useCORS: true
                });

                const imgData = canvas.toDataURL('image/png');

                receiptImage.src = imgData;
                receiptImageContainer.classList.remove('hidden');

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
                if (tempContainer.parentNode) {
                    tempContainer.parentNode.removeChild(tempContainer);
                }
            }
        }
    }

    async function asignarResponsableTicket(ticketData) {
        try {
            if (typeof getAgentBySkill === 'function') {
                const agente = await getAgentBySkill(ticketData.categoria);
                if (agente && agente.nombre_completo) {
                    ticketData.agente_id = agente.id;
                    ticketData.asignado_a = agente.nombre_completo;
                    console.log(`Asignación Automática de Base de Datos: ${agente.nombre_completo} (Skill: ${ticketData.categoria})`);
                    return;
                }

                if (typeof getAgentsWithNullSkill === 'function') {
                    const agentesComunes = await getAgentsWithNullSkill();
                    if (agentesComunes && agentesComunes.length > 0) {
                        const indiceAzar = Math.floor(Math.random() * agentesComunes.length);
                        const agenteSorteado = agentesComunes[indiceAzar];

                        ticketData.agente_id = agenteSorteado.id;
                        ticketData.asignado_a = agenteSorteado.nombre_completo;
                        console.log(`Sorteo entre Agentes sin Skill (NULL): ${agenteSorteado.nombre_completo}`);
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudo consultar la asignación de agente en la base de datos:', e);
        }

        ticketData.agente_id = null;
        ticketData.asignado_a = 'SIN ASIGNAR';
        console.log('El ticket se creará sin agente asignado.');
    }

    // ====================================================================
    //  SOPORTE — Submit
    // ====================================================================
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        let isValid = true;

        form.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });

        const requiredFields = ['fullName', 'email', 'sucursal', 'categoria', 'asunto', 'descripcion'];

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
            const submitBtn = form.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;

            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>Enviando...</span>`;
            submitBtn.style.opacity = '0.8';
            submitBtn.disabled = true;

            const ticketData = {
                nombre: document.getElementById('fullName').value.trim(),
                email: document.getElementById('email').value.trim(),
                sucursal: document.getElementById('sucursal').value,
                categoria: document.getElementById('categoria').value,
                prioridad: document.getElementById('prioridad').value,
                asunto: document.getElementById('asunto').value.trim(),
                descripcion: document.getElementById('descripcion').value.trim()
            };

            try {
                if (!soporteProfileState.currentUserId) {
                    try {
                        const res = await searchProfileByNameOrEmail(ticketData.nombre, ticketData.email);
                        if (res && res.profile) {
                            soporteProfileState.currentUserId = res.profile.id;
                            soporteProfileState.profileExists = true;
                        } else {
                            const nuevoUsuario = await createProfileIfDoesNotExist(ticketData.nombre, ticketData.email);
                            if (nuevoUsuario && nuevoUsuario.id) {
                                soporteProfileState.currentUserId = nuevoUsuario.id;
                                soporteProfileState.profileExists = true;
                            }
                        }
                    } catch (profileError) {
                        console.warn('Error al verificar/crear el perfil del usuario:', profileError);
                    }
                }

                ticketData.usuario_id = soporteProfileState.currentUserId;

                await asignarResponsableTicket(ticketData);

                const ticketCreado = await sendTicketToDB(ticketData);

                const ticketIdParaMostrar = ticketCreado && ticketCreado.id ? `#TCK-${ticketCreado.id}` : `#TCK-${Math.floor(Math.random() * 9000) + 1000}`;
                document.getElementById('ticketId').textContent = ticketIdParaMostrar;

                form.style.display = 'none';
                if (ticketHeader) ticketHeader.style.display = 'none';
                if (statusContainer) statusContainer.classList.add('hidden');
                successMessage.classList.remove('hidden');

                await generateReceiptImage(ticketData, ticketIdParaMostrar);

                form.reset();
            } catch (error) {
                console.error('Error al enviar ticket a Supabase:', error);
                alert(`Error al enviar el ticket: ${error.message || error}`);
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
            }
        }
    });

    // ====================================================================
    //  SOPORTE — Test (previsualizar sin enviar a DB)
    // ====================================================================
    if (testTicketBtn) {
        testTicketBtn.addEventListener('click', async function () {
            let isValid = true;

            form.querySelectorAll('.form-group').forEach(group => {
                group.classList.remove('error');
            });

            const requiredFields = ['fullName', 'email', 'sucursal', 'categoria', 'asunto', 'descripcion'];

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
                    sucursal: document.getElementById('sucursal').value,
                    categoria: document.getElementById('categoria').value,
                    prioridad: document.getElementById('prioridad').value,
                    asunto: document.getElementById('asunto').value.trim(),
                    descripcion: document.getElementById('descripcion').value.trim()
                };

                try {
                    await asignarResponsableTicket(ticketData);

                    const ticketIdFalso = `#TCK-TEST-${Math.floor(Math.random() * 9000) + 1000}`;
                    document.getElementById('ticketId').textContent = ticketIdFalso;

                    form.style.display = 'none';
                    if (ticketHeader) ticketHeader.style.display = 'none';
                    if (statusContainer) statusContainer.classList.add('hidden');
                    successMessage.classList.remove('hidden');

                    await generateReceiptImage(ticketData, ticketIdFalso);

                    form.reset();
                } catch (error) {
                    console.error('Error al previsualizar ticket:', error);
                    alert(`Error al generar la previsualización: ${error.message || error}`);
                } finally {
                    testTicketBtn.innerHTML = originalBtnText;
                    testTicketBtn.style.opacity = '1';
                    testTicketBtn.disabled = false;
                }
            }
        });
    }

    // Reset Soporte
    newTicketBtn.addEventListener('click', () => {
        successMessage.classList.add('hidden');
        form.style.display = 'flex';
        if (ticketHeader) ticketHeader.style.display = 'block';
        if (statusContainer) statusContainer.classList.add('hidden');
        if (receiptImageContainer) receiptImageContainer.classList.add('hidden');
        if (receiptImage) receiptImage.src = '';
        soporteProfileState.profileExists = false;
        soporteProfileState.currentUserId = null;
    });

    // ====================================================================
    //  TAB NAVIGATION
    // ====================================================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const tabIndicator = document.getElementById('tabIndicator');

    tabBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('active')) return;

            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (tabIndicator) {
                tabIndicator.classList.remove('pos-0', 'pos-1');
                tabIndicator.classList.add(`pos-${index}`);
            }

            const targetTab = btn.getAttribute('data-tab');
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.getAttribute('data-panel') === targetTab) {
                    panel.classList.add('active');
                }
            });
        });
    });

    // ====================================================================
    //  FACILITIES — Submit
    // ====================================================================
    const facForm = document.getElementById('facilitiesForm');
    const facSuccessMessage = document.getElementById('facSuccessMessage');
    const facNewTicketBtn = document.getElementById('facNewTicketBtn');
    const facTicketHeader = document.querySelector('#panelFacilities .ticket-header p');

    if (facForm) {
        facForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            let isValid = true;

            facForm.querySelectorAll('.form-group').forEach(group => {
                group.classList.remove('error');
            });

            const facRequiredFields = ['facFullName', 'facEmail', 'facSucursal', 'facCategoria', 'facUbicacion', 'facAsunto', 'facDescripcion'];
            facRequiredFields.forEach(fieldId => {
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
                const submitBtn = facForm.querySelector('.submit-btn');
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>Enviando...</span>`;
                submitBtn.style.opacity = '0.8';
                submitBtn.disabled = true;

                const facData = {
                    nombre: document.getElementById('facFullName').value.trim(),
                    email: document.getElementById('facEmail').value.trim(),
                    sucursal: document.getElementById('facSucursal').value,
                    categoria: document.getElementById('facCategoria').value,
                    ubicacion: document.getElementById('facUbicacion').value.trim(),
                    asunto: document.getElementById('facAsunto').value.trim(),
                    descripcion: document.getElementById('facDescripcion').value.trim(),
                    tipo: 'facilities'
                };

                try {
                    // Buscar o crear perfil para Facilities
                    if (!facProfileState.currentUserId) {
                        try {
                            const res = await searchProfileByNameOrEmail(facData.nombre, facData.email);
                            if (res && res.profile) {
                                facProfileState.currentUserId = res.profile.id;
                                facProfileState.profileExists = true;
                            } else {
                                const nuevoUsuario = await createProfileIfDoesNotExist(facData.nombre, facData.email);
                                if (nuevoUsuario && nuevoUsuario.id) {
                                    facProfileState.currentUserId = nuevoUsuario.id;
                                    facProfileState.profileExists = true;
                                }
                            }
                        } catch (profileError) {
                            console.warn('Error al verificar/crear el perfil del usuario (Facilities):', profileError);
                        }
                    }

                    facData.usuario_id = facProfileState.currentUserId;

                    // Por ahora, simular éxito (integrar con DB después)
                    const facTicketId = `#FAC-${Math.floor(Math.random() * 9000) + 1000}`;
                    document.getElementById('facTicketId').textContent = facTicketId;

                    facForm.style.display = 'none';
                    if (facTicketHeader) facTicketHeader.style.display = 'none';
                    if (facStatusContainer) facStatusContainer.classList.add('hidden');
                    facSuccessMessage.classList.remove('hidden');
                    facForm.reset();
                } catch (error) {
                    console.error('Error al enviar solicitud de facilities:', error);
                    alert(`Error al enviar la solicitud: ${error.message || error}`);
                } finally {
                    submitBtn.innerHTML = originalBtnText;
                    submitBtn.style.opacity = '1';
                    submitBtn.disabled = false;
                }
            }
        });
    }

    if (facNewTicketBtn) {
        facNewTicketBtn.addEventListener('click', () => {
            facSuccessMessage.classList.add('hidden');
            facForm.style.display = 'flex';
            if (facTicketHeader) facTicketHeader.style.display = 'block';
            if (facStatusContainer) facStatusContainer.classList.add('hidden');
            facProfileState.profileExists = false;
            facProfileState.currentUserId = null;
        });
    }
});
