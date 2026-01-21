from flask import jsonify


def json_response(payload: dict, status: int = 200):
    return jsonify(payload), status


def error_response(message: str, status: int = 400):
    return jsonify({"error": message}), status
