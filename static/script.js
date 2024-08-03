$(document).ready(function() {
    let originalInitialProbability = null;
    let originalRecalibratedProbability = null;

    // Funzione di inizializzazione dei modali
    function initializeModals() {
        $('#resultModal').on('hidden.bs.modal', function () {
            resetResultModal();
        });

        $('#mainModal').on('hidden.bs.modal', function () {
            resetMainModal();
        });
    }

    // Funzione per resettare il modale dei risultati
    function resetResultModal() {
        document.getElementById('fileName').value = '';
        document.getElementById('exportTxt').checked = true;
        document.getElementById('recalibratedProbability').value = '';
        document.getElementById('initialProbability').value = '';
        document.getElementById('result-message').innerText = '';
        document.getElementById('warning-text').style.display = 'none';
    }

    // Funzione per resettare il modale principale
    function resetMainModal() {
        document.getElementById('calculation-form').reset();
        const calculateButton = document.getElementById('calculate-button');
        calculateButton.removeAttribute('data-original-title');
        $('[data-toggle="tooltip"]').tooltip('update');
        document.getElementById('error-message').style.display = 'none';
        toggleCalculateButton();
    }

    // Funzione per gestire l'abilitazione/disabilitazione del pulsante di calcolo
    function toggleCalculateButton() {
        const form = document.getElementById('calculation-form');
        const calculateButton = document.getElementById('calculate-button');
        const fields = form.querySelectorAll('input[required], select[required]');
        const allFieldsFilled = Array.from(fields).every(field => field.value !== "-" && field.value !== "");

        const isFormValid = form.checkValidity();
        const isButtonEnabled = isFormValid && allFieldsFilled;
        calculateButton.disabled = !isButtonEnabled;

        if (!isButtonEnabled) {
            updateTooltip(calculateButton);
        } else {
            calculateButton.removeAttribute('data-original-title');
        }
    }

    // Funzione per aggiornare il tooltip
    function updateTooltip(button) {
        let missingFields = [];
        if (!document.getElementById('age').value) missingFields.push('Date of Birth');
        if (document.getElementById('stage').value === '-') missingFields.push('Stage');
        if (document.getElementById('grade').value === '-') missingFields.push('Grade');
        if (document.getElementById('extent').value === '-') missingFields.push('Extent');

        const tooltipText = missingFields.length > 0 ? 'Please fill in: ' + missingFields.join(', ') : '';
        button.setAttribute('data-original-title', tooltipText);
        $('[data-toggle="tooltip"]').tooltip('update');
    }

    // Funzione per calcolare l'età
    function calculateAge(dob) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    }

    // Funzione per calcolare e mostrare i risultati
    window.calculate = function() {
        const dob = document.getElementById('age').value;
        const stage = document.getElementById('stage').value;
        const grade = document.getElementById('grade').value;
        const extent = document.getElementById('extent').value;

        if (!dob || stage === "-" || grade === "-" || extent === "-") {
            document.getElementById('error-message').innerHTML = 'Please fill in all required fields.';
            document.getElementById('error-message').style.display = 'block';
            return;
        }

        const age = calculateAge(new Date(dob));
        document.getElementById('error-message').style.display = 'none';

        fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ age, stage, grade, extent })
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text);
                });
            }
            return response.json();
        })
        .then(data => {
            originalInitialProbability = data.initial_probability;
            originalRecalibratedProbability = data.recalibrated_probability;

            const recalibratedProbability = parseFloat(data.recalibrated_probability);
            const messageClass = recalibratedProbability > 0.07 ? 'text-danger' : 'text-success';
            const message = recalibratedProbability > 0.07 ?
                'If the patient will respect the maintenance schedule according to the current literature, he/she is at "High risk" of losing 2 or more teeth at 10 years of follow-up due to periodontal reasons' :
                'If the patient will respect the maintenance schedule according to the current literature, he/she is at "Low risk" of losing 2 or more teeth at 10 years of follow-up due to periodontal reasons';

            $('#resultModal').modal('show').on('shown.bs.modal', function () {
                const resultMessageElement = document.getElementById('result-message');
                resultMessageElement.innerText = message;
                resultMessageElement.className = messageClass; // Applica la classe CSS al messaggio
            });
        })
        .catch(error => {
            console.error('Error during fetch:', error);
        });
    };

    // Funzione per esportare i risultati
    window.exportFile = function() {
        const formatElements = document.getElementsByName('exportFormat');
        let format = '';
        for (const element of formatElements) {
            if (element.checked) {
                format = element.value;
                break;
            }
        }

        if (!format) {
            console.error('No export format selected.');
            return;
        }

        const fileName = document.getElementById('fileName').value.trim();
        const dob = document.getElementById('age').value;
        const stage = document.getElementById('stage').value;
        const grade = document.getElementById('grade').value;
        const extent = document.getElementById('extent').value;
        const message = document.getElementById('result-message').innerText;
        const recalibratedProbability = originalRecalibratedProbability ? (parseFloat(originalRecalibratedProbability) * 100).toFixed(2) : '0';

        const timestamp = new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/\//g, '').replace(/,/g, '').replace(/ /g, '-').replace(/:/g, '');

        const fileNameExport = fileName ? fileName : `ResultRiskAssessment_${timestamp}`;

        if (format === 'txt') {
            exportToTxt(fileNameExport, dob, stage, grade, extent, recalibratedProbability, message);
        } else if (format === 'pdf') {
            exportToPdf(fileNameExport, dob, stage, grade, extent, recalibratedProbability, message);
        }
    };

    // Funzione per esportare i dati in formato TXT
    function exportToTxt(fileNameExport, dob, stage, grade, extent, recalibratedProbability, message) {
        const blob = new Blob([
            `Date of Birth: ${dob}\n` +
            `Stage: ${stage}\n` +
            `Grade: ${grade}\n` +
            `Extent: ${extent}\n` +
            `Probability: ${recalibratedProbability}%\n` +
            `Message: ${message}`
        ], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileNameExport}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Funzione per esportare i dati in formato PDF
    function exportToPdf(fileNameExport, dob, stage, grade, extent, recalibratedProbability, message) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const margin = 10;
        const lineHeight = 10;
        const pageWidth = doc.internal.pageSize.width - 2 * margin;
        
        doc.text(`Date of Birth: ${dob}`, margin, margin + lineHeight);
        doc.text(`Stage: ${stage}`, margin, margin + 2 * lineHeight);
        doc.text(`Grade: ${grade}`, margin, margin + 3 * lineHeight);
        doc.text(`Extent: ${extent}`, margin, margin + 4 * lineHeight);
        doc.text(`Probability: ${recalibratedProbability}%`, margin, margin + 5 * lineHeight);

        const messageLines = doc.splitTextToSize(`Message: ${message}`, pageWidth);
        doc.text(messageLines, margin, margin + 6 * lineHeight);

        doc.save(`${fileNameExport}.pdf`);
    }

    // Funzione per resettare il modulo di calcolo
    window.resetForm = function() {
        document.getElementById('calculation-form').reset();
        document.getElementById('calculate-button').disabled = true;
    };

    // Aggiungi event listener ai campi richiesti per abilitare/disabilitare il pulsante di calcolo
    function addFieldEventListeners() {
        const fields = document.querySelectorAll('input[required], select[required]');
        fields.forEach(field => {
            field.addEventListener('input', toggleCalculateButton);
            field.addEventListener('change', toggleCalculateButton);
        });
    }

    // Inizializzazione delle funzioni
    initializeModals();
    addFieldEventListeners();
    toggleCalculateButton();
});
