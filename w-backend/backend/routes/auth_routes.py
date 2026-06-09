from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import check_password_hash
from backend.database import get_db_connection
import jwt
from datetime import datetime, timedelta

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def rota_login():

    dados = request.get_json()

    email = dados.get("email")
    senha = dados.get("senha")

    conn = get_db_connection()

    user = conn.execute("""
        SELECT 
            f.id_funcionario,
            f.nome,
            f.email,
            l.senha,
            l.tipo_user
        FROM Funcionario f
        JOIN Login l
            ON f.id_funcionario = l.id_user
        WHERE f.email = ?
    """, (email,)).fetchone()

    conn.close()

    if not user:
        return jsonify({
            "status": "erro",
            "mensagem": "Usuário não encontrado"
        }), 401

    if not check_password_hash(user["senha"], senha):
        return jsonify({
            "status": "erro",
            "mensagem": "Senha incorreta"
        }), 401

    # =========================
    # ROLES
    # =========================
    if user["tipo_user"] == 1:
        roles = ["admin"]
    elif user["tipo_user"] == 2:
        roles = ["funcionario"]
    else:
        roles = ["admin", "funcionario"]

    # =========================
    # JWT
    # =========================
    token = jwt.encode(
        {
            "id": user["id_funcionario"],
            "nome": user["nome"],
            "email": user["email"],
            "roles": roles,
            "exp": datetime.utcnow() + timedelta(hours=8)
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256"
    )

    return jsonify({
        "status": "logado",
        "token": token,
        "user": {
            "id": user["id_funcionario"],
            "nome": user["nome"],
            "email": user["email"],
            "roles": roles
        }
    }), 200