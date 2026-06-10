import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from data_service import DataService

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
ds = DataService(DATA_DIR)


@app.route('/api/resources', methods=['GET'])
def get_resources():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_resources(year))


@app.route('/api/resources', methods=['POST'])
def add_resource():
    data = request.json
    resource = ds.add_resource(data)
    return jsonify(resource), 201


@app.route('/api/resources/<int:resource_id>', methods=['PUT'])
def update_resource(resource_id):
    data = request.json
    resource = ds.update_resource(resource_id, data)
    if resource is None:
        return jsonify({'error': 'Resource not found'}), 404
    return jsonify(resource)


@app.route('/api/resources/<int:resource_id>', methods=['DELETE'])
def delete_resource(resource_id):
    ok = ds.delete_resource(resource_id)
    if not ok:
        return jsonify({'error': 'Resource not found'}), 404
    return '', 204


@app.route('/api/resources/import/preview', methods=['POST'])
def preview_import():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    year = request.form.get('year', type=int, default=None)
    result = ds.preview_import(file, year)
    if 'error' in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/resources/import/confirm', methods=['POST'])
def confirm_import():
    data = request.json
    rows = data.get('rows', [])
    result = ds.bulk_add_resources(rows)
    return jsonify(result), 201


@app.route('/api/resources/import/template', methods=['GET'])
def download_template():
    from flask import send_file
    path = ds.generate_import_template()
    return send_file(path, as_attachment=True, download_name='template_import_ressources.xlsx')


@app.route('/api/presence', methods=['GET'])
def get_presence():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_presence(year))


@app.route('/api/presence', methods=['POST'])
def update_presence():
    data = request.json
    if isinstance(data, list):
        ds.bulk_update_presence(data)
    else:
        ds.update_presence(data)
    return jsonify({'status': 'ok'})


@app.route('/api/presence/dashboard', methods=['GET'])
def get_presence_dashboard():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_presence_dashboard(year))


@app.route('/api/consumption', methods=['GET'])
def get_consumption():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_consumption(year))


@app.route('/api/consumption', methods=['POST'])
def update_consumption():
    data = request.json
    ds.update_consumption(data)
    return jsonify({'status': 'ok'})


@app.route('/api/previsions', methods=['GET'])
def get_previsions():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_previsions(year))


@app.route('/api/previsions', methods=['POST'])
def add_prevision():
    data = request.json
    prev = ds.add_prevision(data)
    return jsonify(prev), 201


@app.route('/api/previsions/<int:prevision_id>', methods=['PUT'])
def update_prevision(prevision_id):
    data = request.json
    prev = ds.update_prevision(prevision_id, data)
    if prev is None:
        return jsonify({'error': 'Prevision not found'}), 404
    return jsonify(prev)


@app.route('/api/previsions/<int:prevision_id>', methods=['DELETE'])
def delete_prevision(prevision_id):
    ok = ds.delete_prevision(prevision_id)
    if not ok:
        return jsonify({'error': 'Prevision not found'}), 404
    return '', 204


@app.route('/api/settings', methods=['GET'])
def get_settings():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_settings(year))


@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = request.json
    result = ds.update_settings(data)
    return jsonify(result)


@app.route('/api/settings/all', methods=['GET'])
def get_all_settings():
    return jsonify(ds.get_all_settings())


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    year = request.args.get('year', type=int)
    return jsonify(ds.get_dashboard(year))


@app.route('/api/years', methods=['GET'])
def get_years():
    return jsonify(ds.get_years())


@app.route('/api/comparison', methods=['GET'])
def get_comparison():
    years_param = request.args.get('years', '')
    try:
        selected = [int(y.strip()) for y in years_param.split(',') if y.strip()]
    except ValueError:
        return jsonify({'error': 'Invalid years parameter'}), 400
    if not selected:
        selected = ds.get_years()
    return jsonify(ds.get_comparison(selected))


if __name__ == '__main__':
    app.run(debug=True, port=5001)
