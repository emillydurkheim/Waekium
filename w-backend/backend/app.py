import os
import sqlite3
from flask import Flask, request, jsonify
from backend.database import get_db_connection, init_db
from flask_cors import CORS
from werkzeug.security import generate_password_hash

from backend.routes.auth_routes import auth_bp
from backend.routes.user_routes import user_bp
from backend.routes.ponto_routes import ponto_bp
from backend.routes.face_routes import face_bp
from backend.routes.agenda_routes import agenda_bp
from backend.routes.rotas_routes import rotas_bp
from backend.routes.paradas_routes import paradas_bp    
from backend.routes.rh_routes import rh_bp


app = Flask(__name__)
CORS(app)

app.config["SECRET_KEY"] = os.environ.get(
    "SECRET_KEY",
    "waekium-default-secret-key-change-me-2026",
)

# =========================
# BLUEPRINTS
# =========================
app.register_blueprint(auth_bp)
app.register_blueprint(user_bp)
app.register_blueprint(face_bp)
app.register_blueprint(ponto_bp)
app.register_blueprint(agenda_bp)
app.register_blueprint(rotas_bp)
app.register_blueprint(paradas_bp)
app.register_blueprint(rh_bp)

init_db()


@app.route("/")
def home():
    return jsonify({"mensagem": "API da Transportadora rodando!"}), 200


# =========================
# CADASTRO FUNCIONÁRIO
# =========================
def salvar_no_banco(dados):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # =========================
        # Estado
        # =========================
        cursor.execute(
            "SELECT id_est FROM Estado WHERE sigla = ?",
            (dados['sigla_estado'],)
        )
        estado = cursor.fetchone()
        id_est = estado['id_est'] if estado else None

        if not id_est:
            cursor.execute(
                "INSERT INTO Estado (nome, sigla) VALUES (?, ?)",
                (dados.get('nome_estado', 'Estado'), dados['sigla_estado'])
            )
            id_est = cursor.lastrowid

        # =========================
        # Cidade
        # =========================
        cursor.execute(
            "SELECT id_cid FROM Cidade WHERE cidade = ? AND id_est = ?",
            (dados['cidade'], id_est)
        )
        cidade = cursor.fetchone()
        id_cid = cidade['id_cid'] if cidade else None

        if not id_cid:
            cursor.execute(
                "INSERT INTO Cidade (cidade, id_est) VALUES (?, ?)",
                (dados['cidade'], id_est)
            )
            id_cid = cursor.lastrowid

        # =========================
        # FUNCIONÁRIO (FIX PRINCIPAL AQUI)
        # =========================
        cursor.execute("""
            INSERT INTO Funcionario 
            (nome, cpf, telefone, email, endereco, cep, id_cid, id_est, id_funcao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            dados['nome'],
            dados['cpf'],
            dados.get('telefone'),
            dados['email'],
            dados.get('endereco'),
            dados.get('cep'),
            id_cid,
            id_est,
            dados['id_funcao']
        ))

        id_funcionario = cursor.lastrowid

        # =========================
        # LOGIN (HASH OK)
        # =========================
        cursor.execute("""
            INSERT INTO Login (id_user, tipo_user, senha)
            VALUES (?, ?, ?)
        """, (
            id_funcionario,
            2,
            generate_password_hash(dados['senha'])
        ))

        conn.commit()

        return {
            "status": "sucesso",
            "id": id_funcionario
        }

    except sqlite3.IntegrityError as e:
        conn.rollback()
        return {
            "status": "erro",
            "mensagem": str(e)
        }

    except Exception as e:
        conn.rollback()
        return {
            "status": "erro",
            "mensagem": str(e)
        }

    finally:
        conn.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
