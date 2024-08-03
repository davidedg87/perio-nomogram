$(document).ready(function() {
    let originalInitialProbability = null;
    let originalRecalibratedProbability = null;

    $('#resultModal').on('hidden.bs.modal', function () {
        document.getElementById('fileName').value = '';
        document.getElementById('exportTxt').checked = true;
        document.getElementById('recalibratedProbability').value = '';
        document.getElementById('initialProbability').value = '';
        document.getElementById('result-message').innerText = '';
        document.getElementById('warning-text').style.display = 'none';
    });
	
	 // Gestione della chiusura della modale principale
    $('#mainModal').on('hidden.bs.modal', function () {
        resetMainModal();
    });
	
	 function resetMainModal() {
        // Resetta i valori del modulo
        document.getElementById('calculation-form').reset();

        // Rimuove il tooltip di errore
        const calculateButton = document.getElementById('calculate-button');
        calculateButton.removeAttribute('data-original-title');
        $('[data-toggle="tooltip"]').tooltip('update');

        // Rimuove eventuali messaggi di errore
        document.getElementById('error-message').style.display = 'none';

        // Disabilita il pulsante di calcolo se necessario
        toggleCalculateButton();
    }
	
	
	

    function toggleCalculateButton() {
        const form = document.getElementById('calculation-form');
        const calculateButton = document.getElementById('calculate-button');
        const fields = form.querySelectorAll('input[required], select[required]');
        const allFieldsFilled = Array.from(fields).every(field => field.value !== "-" && field.value !== "");

        const isFormValid = form.checkValidity();
        const isButtonEnabled = isFormValid && allFieldsFilled;
        calculateButton.disabled = !isButtonEnabled;

        if (!isButtonEnabled) {
            let missingFields = [];
            if (!document.getElementById('age').value) missingFields.push('Date of Birth');
            if (document.getElementById('stage').value === '-') missingFields.push('Stage');
            if (document.getElementById('grade').value === '-') missingFields.push('Grade');
            if (document.getElementById('extent').value === '-') missingFields.push('Extent');

            const tooltipText = missingFields.length > 0 ? 'Please fill in: ' + missingFields.join(', ') : '';
            calculateButton.setAttribute('data-original-title', tooltipText);
            $('[data-toggle="tooltip"]').tooltip('update');
        } else {
            calculateButton.removeAttribute('data-original-title');
        }
    }

    const fields = document.querySelectorAll('input[required], select[required]');
    fields.forEach(field => {
        field.addEventListener('input', toggleCalculateButton);
        field.addEventListener('change', toggleCalculateButton);
    });

    toggleCalculateButton();

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
        headers: {
            'Content-Type': 'application/json'
        },
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
        let message = '';

        // Determina il colore del messaggio
        const messageClass = recalibratedProbability > 0.07 ? 'text-danger' : 'text-success';

        if (recalibratedProbability > 0.07) {
            message = 'If the patient will respect the maintenance schedule according to the current literature, he/she is at "High risk" of losing 2 or more teeth at 10 years of follow-up due to periodontal reasons';
        } else {
            message = 'If the patient will respect the maintenance schedule according to the current literature, he/she is at "Low risk" of losing 2 or more teeth at 10 years of follow-up due to periodontal reasons';
        }

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

		const recalibratedProbability  = originalRecalibratedProbability ? (parseFloat(originalRecalibratedProbability) * 100).toFixed(2) : '0';


		const timestamp = new Date().toLocaleString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).replace(/\//g, '').replace(/,/g, '').replace(/ /g, '-').replace(/:/g, '');

		const fileNameExport = fileName ? fileName : `ResultRiskAssessment_${timestamp}`;

		if (format === 'txt') {
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
		} else if (format === 'pdf') {
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

			// Using the `splitTextToSize` method to wrap the text
			const messageLines = doc.splitTextToSize(`Message: ${message}`, pageWidth);
			doc.text(messageLines, margin, margin + 6 * lineHeight);

			doc.save(`${fileNameExport}.pdf`);
		}
	};



    window.resetForm = function() {
        document.getElementById('calculation-form').reset();
		document.getElementById('calculate-button').disabled = true;
    };

    function calculateAge(dob) {
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    }
});
