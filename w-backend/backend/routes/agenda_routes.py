from flask import Blueprint, jsonify, request

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

agenda_bp = Blueprint("agenda", __name__)


def _agenda_to_dict(item):
    return {
        "id_agenda": item["id_agenda"],
        "id_funcionario": item["id_funcionario"],
        "tipo": item["tipo"],
        "titulo": item["titulo"],
        "descricao": item["descricao"],
        "endereco": item["endereco"],
        "latitude": item["latitude"],
        "longitude": item["longitude"],
        "data": item["data"],
        "horario": item["horario"],
        "status": item["status"],
        "criado_por": item["criado_por"],
    }


@agenda_bp.route("/agenda", methods=["POST"])
@token_required
def criar_agenda():
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        required = ["id_funcionario", "tipo", "titulo", "endereco", "data"]
        missing = [campo for campo in required if not dados.get(campo)]
        if missing:
            return jsonify({"status": "erro", "erro": f"Campos obrigatorios: {', '.join(missing)}"}), 400

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO Agenda (
                id_funcionario, tipo, titulo, descricao, endereco,
                latitude, longitude, data, horario, status, criado_por
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                dados["id_funcionario"],
                dados["tipo"],
                dados["titulo"],
                dados.get("descricao"),
                dados["endereco"],
                dados.get("latitude"),
                dados.get("longitude"),
                dados["data"],
                dados.get("horario"),
                dados.get("status", "pendente"),
                dados.get("criado_por"),
            ),
        )
        id_agenda = int(cursor.lastrowid)
        conn.commit()

        item = conn.execute("SELECT * FROM Agenda WHERE id_agenda = ?", (id_agenda,)).fetchone()
        return jsonify(_agenda_to_dict(item)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@agenda_bp.route("/agenda/<int:id_funcionario>", methods=["GET"])
@token_required
def listar_agenda(id_funcionario):
    conn = get_db_connection()
    try:
        agenda = conn.execute(
            """
            SELECT *
            FROM Agenda
            WHERE id_funcionario = ?
            ORDER BY data, horario
            """,
            (id_funcionario,),
        ).fetchall()
        return jsonify([_agenda_to_dict(item) for item in agenda]), 200
    finally:
        conn.close()


@agenda_bp.route("/agenda/status/<int:id_agenda>", methods=["PUT"])
@token_required
def atualizar_status(id_agenda):
    dados = request.get_json(silent=True) or {}
    status = dados.get("status")
    if not status:
        return jsonify({"status": "erro", "erro": "Status obrigatorio"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "UPDATE Agenda SET status = ? WHERE id_agenda = ?",
            (status, id_agenda),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Agenda nao encontrada"}), 404
        return jsonify({"status": "atualizado"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@agenda_bp.route("/agenda/<int:id_agenda>", methods=["PUT"])
@token_required
def editar_agenda(id_agenda):
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        atual = conn.execute("SELECT * FROM Agenda WHERE id_agenda = ?", (id_agenda,)).fetchone()
        if not atual:
            return jsonify({"status": "erro", "erro": "Agenda nao encontrada"}), 404

        conn.execute(
            """
            UPDATE Agenda
            SET id_funcionario = ?,
                tipo = ?,
                titulo = ?,
                descricao = ?,
                endereco = ?,
                latitude = ?,
                longitude = ?,
                data = ?,
                horario = ?,
                status = ?,
                criado_por = ?
            WHERE id_agenda = ?
            """,
            (
                dados.get("id_funcionario", atual["id_funcionario"]),
                dados.get("tipo", atual["tipo"]),
                dados.get("titulo", atual["titulo"]),
                dados.get("descricao", atual["descricao"]),
                dados.get("endereco", atual["endereco"]),
                dados.get("latitude", atual["latitude"]),
                dados.get("longitude", atual["longitude"]),
                dados.get("data", atual["data"]),
                dados.get("horario", atual["horario"]),
                dados.get("status", atual["status"]),
                dados.get("criado_por", atual["criado_por"]),
                id_agenda,
            ),
        )
        conn.commit()
        item = conn.execute("SELECT * FROM Agenda WHERE id_agenda = ?", (id_agenda,)).fetchone()
        return jsonify(_agenda_to_dict(item)), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@agenda_bp.route("/agenda/<int:id_agenda>", methods=["DELETE"])
@token_required
def deletar_agenda(id_agenda):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM Agenda WHERE id_agenda = ?", (id_agenda,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Agenda nao encontrada"}), 404
        return jsonify({"status": "deletado"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@agenda_bp.route("/agenda/completa/<int:id_funcionario>", methods=["GET"])
@token_required
def agenda_completa(id_funcionario):
    conn = get_db_connection()
    try:
        agendas = conn.execute(
            """
            SELECT *
            FROM Agenda
            WHERE id_funcionario = ?
            ORDER BY data, horario
            """,
            (id_funcionario,),
        ).fetchall()

        resultado = []
        for agenda in agendas:
            rotas = conn.execute(
                """
                SELECT *
                FROM Rotas
                WHERE id_agenda = ?
                ORDER BY ordem, id_rota
                """,
                (agenda["id_agenda"],),
            ).fetchall()

            lista_rotas = []
            for rota in rotas:
                paradas = conn.execute(
                    """
                    SELECT *
                    FROM Paradas
                    WHERE id_rota = ?
                    ORDER BY ordem, id_parada
                    """,
                    (rota["id_rota"],),
                ).fetchall()

                lista_rotas.append(
                    {
                        "id_rota": rota["id_rota"],
                        "nome_rota": rota["nome_rota"],
                        "descricao": rota["descricao"],
                        "ordem": rota["ordem"],
                        "origem": rota["origem"],
                        "destino": rota["destino"],
                        "maps_url": rota["maps_url"],
                        "status": rota["status"],
                        "paradas": [dict(parada) for parada in paradas],
                    }
                )

            item = _agenda_to_dict(agenda)
            item["rotas"] = lista_rotas
            resultado.append(item)

        return jsonify(resultado), 200
    finally:
        conn.close()
