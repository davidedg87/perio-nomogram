from flask import Flask, render_template, request, jsonify
import pickle
import numpy as np

app = Flask(__name__)

# Carica il modello pkl
with open('model.pkl', 'rb') as file:
    iso_reg_loaded = pickle.load(file)

def recalibrate_probability(initial_probability):
    if initial_probability is not None and 0 <= initial_probability <= 1:
        recalibrated = iso_reg_loaded.transform([initial_probability])
        return recalibrated[0]
    else:
        return "Invalid probability value"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json
    age = int(data.get('age'))
    stage = data.get('stage')
    grade = data.get('grade')
    extent = data.get('extent')

    if not all([age is not None, stage, grade, extent]) or stage == '-' or grade == '-' or extent == '-':
        return jsonify({'error': 'Please fill in all required fields.'}), 400

    if stage == '1' or stage == '2':
        stage_coef = 0
    elif stage == '3':
        stage_coef = 0.9255798
    elif stage == '4':
        stage_coef = 2.269515
    else:
        return jsonify({'error': 'Invalid stage value.'}), 400

    extent_coef = 0.2907061 if extent == 'Generalized' else 0

    if grade == 'A':
        grade_coef = 0
    elif grade == 'B':
        grade_coef = 0.5013877
    elif grade == 'C':
        grade_coef = 2.138476
    else:
        return jsonify({'error': 'Invalid grade value.'}), 400

    variable = (0.00240872 * age +
                stage_coef +
                extent_coef +
                grade_coef +
                -5.711725)

    def invlogit(x):
        return 1 / (1 + np.exp(-x))

    initial_probability = invlogit(variable)
    recalibrated_probability = recalibrate_probability(initial_probability)

    result = {
        'initial_probability': initial_probability,
        'recalibrated_probability': recalibrated_probability
    }
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
