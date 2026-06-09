from functools import wraps
from flask import request, jsonify, current_app
import jwt

def token_required(f):

    @wraps(f)
    def decorated(*args, **kwargs):

        token = None

        auth = request.headers.get("Authorization")

        if auth and auth.startswith("Bearer "):
            token = auth.split(" ")[1]

        if not token:
            return jsonify({
                "status": "erro",
                "mensagem": "Token não enviado."
            }), 401

        try:
            dados = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )

            request.user = dados

        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "erro",
                "mensagem": "Token expirado."
            }), 401

        except jwt.InvalidTokenError:
            return jsonify({
                "status": "erro",
                "mensagem": "Token inválido."
            }), 401

        return f(*args, **kwargs)

    return decorated