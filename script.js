document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const fileInput = document.getElementById('attachment');
    const fileUploadBox = document.querySelector('.file-upload-box');
    const fileNameDisplay = document.getElementById('fileName');
    const successMessage = document.getElementById('successMessage');
    const newTicketBtn = document.getElementById('newTicketBtn');
    const ticketHeader = document.querySelector('.ticket-header p');

    // Drag and drop functionality for file upload
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

    // Form Validation and Submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        let isValid = true;

        // Reset previous errors
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error');
        });

        // Basic validation
        const requiredFields = ['fullName', 'email', 'category', 'subject', 'description'];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                showError(field);
                isValid = false;
            } else if (field.type === 'email' && !validateEmail(field.value)) {
                showError(field);
                isValid = false;
            }
        });

        if (isValid) {
            // Simulate API Call / Submission Process
            const submitBtn = document.querySelector('.submit-btn');
            const originalBtnText = submitBtn.innerHTML;
            
            submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>Enviando...</span>`;
            submitBtn.style.opacity = '0.8';
            submitBtn.disabled = true;

            setTimeout(() => {
                // Generate random ticket ID
                const randomId = Math.floor(Math.random() * 9000) + 1000;
                document.getElementById('ticketId').textContent = `#TCK-${randomId}`;

                // Hide form, show success
                form.style.display = 'none';
                ticketHeader.style.display = 'none';
                successMessage.classList.remove('hidden');

                // Reset button for future use
                submitBtn.innerHTML = originalBtnText;
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
                form.reset();
                fileNameDisplay.classList.remove('active');
            }, 1500);
        }
    });

    function showError(element) {
        const group = element.closest('.form-group');
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
        ticketHeader.style.display = 'block';
    });
});
