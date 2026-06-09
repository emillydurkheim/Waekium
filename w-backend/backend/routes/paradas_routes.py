from flask import Blueprint, jsonify, request

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

paradas_bp = Blueprint("paradas", __name__)


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parada_to_dict(row):
    return {
        "id_parada": row["id_parada"],
        "id_rota": row["id_rota"],
        "nome_local": row["nome_local"],
        "endereco": row["endereco"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "horario": row["horario"],
        "status": row["status"],
        "ordem": row["ordem"],
    }


@paradas_bp.route("/paradas", methods=["GET"])
@token_required
def listar_todas_paradas():
    conn = get_db_connection()
    try:
        paradas = conn.execute(
            "SELECT * FROM Paradas ORDER BY id_rota, ordem, id_parada"
        ).fetchall()
        return jsonify([_parada_to_dict(p) for p in paradas]), 200
    finally:
        conn.close()


@paradas_bp.route("/paradas", methods=["POST"])
@token_required
def criar_parada():
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        id_rota = dados.get("id_rota")
        nome_local = _clean(dados.get("nome_local"))
        endereco = _clean(dados.get("endereco"))
        if not id_rota or not nome_local or not endereco:
            return (
                jsonify({"status": "erro", "erro": "id_rota, nome_local e endereco sao obrigatorios"}),
                400,
            )

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO Paradas (
                id_rota, nome_local, endereco, latitude, longitude,
                horario, status, ordem
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id_rota,
                nome_local,
                endereco,
                dados.get("latitude"),
                dados.get("longitude"),
                _clean(dados.get("horario")),
                dados.get("status", "pendente"),
                dados.get("ordem"),
            ),
        )
        id_parada = int(cursor.lastrowid)
        conn.commit()
        parada = conn.execute("SELECT * FROM Paradas WHERE id_parada = ?", (id_parada,)).fetchone()
        return jsonify(_parada_to_dict(parada)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@paradas_bp.route("/paradas/rota/<int:id_rota>", methods=["GET"])
@token_required
def listar_paradas(id_rota):
    conn = get_db_connection()
    try:
        paradas = conn.execute(
            """
            SELECT *
            FROM Paradas
            WHERE id_rota = ?
            ORDER BY ordem, id_parada
            """,
            (id_rota,),
        ).fetchall()
        return jsonify([_parada_to_dict(p) for p in paradas]), 200
    finally:
        conn.close()


@paradas_bp.route("/paradas/status/<int:id_parada>", methods=["PUT"])
@token_required
def atualizar_status_parada(id_parada):
    dados = request.get_json(silent=True) or {}
    status = dados.get("status")
    if not status:
        return jsonify({"status": "erro", "erro": "Status obrigatorio"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "UPDATE Paradas SET status = ? WHERE id_parada = ?",
            (status, id_parada),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Parada nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@paradas_bp.route("/paradas/<int:id_parada>", methods=["PUT"])
@token_required
def atualizar_parada(id_parada):
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        atual = conn.execute("SELECT * FROM Paradas WHERE id_parada = ?", (id_parada,)).fetchone()
        if not atual:
            return jsonify({"status": "erro", "erro": "Parada nao encontrada"}), 404

        conn.execute(
            """
            UPDATE Paradas
            SET nome_local = ?,
                endereco = ?,
                latitude = ?,
                longitude = ?,
                horario = ?,
                status = ?,
                ordem = ?
            WHERE id_parada = ?
            """,
            (
                dados.get("nome_local", atual["nome_local"]),
                dados.get("endereco", atual["endereco"]),
                dados.get("latitude", atual["latitude"]),
                dados.get("longitude", atual["longitude"]),
                dados.get("horario", atual["horario"]),
                dados.get("status", atual["status"]),
                dados.get("ordem", atual["ordem"]),
                id_parada,
            ),
        )
        conn.commit()
        parada = conn.execute("SELECT * FROM Paradas WHERE id_parada = ?", (id_parada,)).fetchone()
        return jsonify(_parada_to_dict(parada)), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@paradas_bp.route("/paradas/<int:id_parada>", methods=["DELETE"])
@token_required
def deletar_parada(id_parada):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM Paradas WHERE id_parada = ?", (id_parada,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Parada nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()
