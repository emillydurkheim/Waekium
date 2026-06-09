from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

rotas_bp = Blueprint("rotas", __name__)

VALID_STATUSES = {"pendente", "em_andamento", "finalizada", "cancelada"}


def _clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _int_or_none(value):
    text = _clean(value)
    if text is None:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _ensure_agenda(cursor, dados: dict) -> int:
    id_agenda = _int_or_none(dados.get("id_agenda"))
    if id_agenda:
        row = cursor.execute("SELECT id_agenda FROM Agenda WHERE id_agenda = ?", (id_agenda,)).fetchone()
        if row:
            return id_agenda

    motorista_id = _int_or_none(dados.get("motoristaId") or dados.get("motorista_id")) or 1
    funcionario = cursor.execute(
        "SELECT id_funcionario FROM Funcionario WHERE id_funcionario = ?",
        (motorista_id,),
    ).fetchone()
    if not funcionario:
        motorista_id = 1

    nome = _clean(dados.get("nome") or dados.get("nome_rota")) or "Rota"
    destino = _clean(dados.get("destino") or dados.get("endereco")) or "Local nao especificado"
    data = _clean(dados.get("data")) or datetime.now().strftime("%Y-%m-%d")

    cursor.execute(
        """
        INSERT INTO Agenda (
            id_funcionario, tipo, titulo, descricao, endereco,
            data, horario, status, criado_por
        )
        VALUES (?, 'rota', ?, ?, ?, ?, ?, 'pendente', 1)
        """,
        (
            motorista_id,
            nome,
            _clean(dados.get("observacoes") or dados.get("descricao")),
            destino,
            data,
            _clean(dados.get("horario")),
        ),
    )
    return int(cursor.lastrowid)


def _paradas_da_rota(conn, id_rota: int):
    rows = conn.execute(
        """
        SELECT *
        FROM Paradas
        WHERE id_rota = ?
        ORDER BY ordem, id_parada
        """,
        (id_rota,),
    ).fetchall()
    return [dict(row) for row in rows]


def _rota_to_web(conn, rota):
    id_rota = int(rota["id_rota"])
    return {
        "id": str(id_rota),
        "nome": rota["nome_rota"],
        "motoristaId": str(rota["motorista_id"] or ""),
        "origem": rota["origem"] or "",
        "destino": rota["destino"] or "",
        "mapsUrl": rota["maps_url"],
        "descricao": rota["descricao"],
        "observacoes": rota["descricao"],
        "data": rota["data"],
        "horario": rota["horario"],
        "status": rota["status"] or "pendente",
        "createdAt": 0,
        "updatedAt": 0,
        "paradas": _paradas_da_rota(conn, id_rota),
    }


@rotas_bp.route("/rotas", methods=["POST"])
@token_required
def criar_rota():
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        nome_rota = _clean(dados.get("nome") or dados.get("nome_rota"))
        motorista_id = _int_or_none(dados.get("motoristaId") or dados.get("motorista_id"))
        origem = _clean(dados.get("origem"))
        destino = _clean(dados.get("destino"))

        if not nome_rota or not motorista_id or not origem or not destino:
            return (
                jsonify(
                    {
                        "status": "erro",
                        "erro": "nome, motoristaId, origem e destino sao obrigatorios",
                    }
                ),
                400,
            )

        cursor = conn.cursor()
        id_agenda = _ensure_agenda(cursor, dados)
        status = dados.get("status") if dados.get("status") in VALID_STATUSES else "pendente"

        cursor.execute(
            """
            INSERT INTO Rotas (
                id_agenda, nome_rota, descricao, origem, destino,
                maps_url, motorista_id, data, horario, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id_agenda,
                nome_rota,
                _clean(dados.get("observacoes") or dados.get("descricao")),
                origem,
                destino,
                _clean(dados.get("mapsUrl") or dados.get("maps_url")),
                motorista_id,
                _clean(dados.get("data")),
                _clean(dados.get("horario")),
                status,
            ),
        )
        nova_rota_id = int(cursor.lastrowid)

        for indice, parada in enumerate(dados.get("paradas") or []):
            nome_local = _clean(parada.get("nome_local"))
            endereco = _clean(parada.get("endereco"))
            if not nome_local or not endereco:
                continue
            cursor.execute(
                """
                INSERT INTO Paradas (
                    id_rota, nome_local, endereco, latitude, longitude,
                    horario, status, ordem
                )
                VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?)
                """,
                (
                    nova_rota_id,
                    nome_local,
                    endereco,
                    parada.get("latitude"),
                    parada.get("longitude"),
                    _clean(parada.get("horario")),
                    parada.get("ordem") or indice + 1,
                ),
            )

        conn.commit()
        rota = conn.execute("SELECT * FROM Rotas WHERE id_rota = ?", (nova_rota_id,)).fetchone()
        return jsonify(_rota_to_web(conn, rota)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@rotas_bp.route("/rotas", methods=["GET"])
@token_required
def listar_rotas():
    conn = get_db_connection()
    try:
        rotas = conn.execute("SELECT * FROM Rotas ORDER BY id_rota DESC").fetchall()
        return jsonify([_rota_to_web(conn, rota) for rota in rotas]), 200
    finally:
        conn.close()


@rotas_bp.route("/rota/<int:id_user>", methods=["GET"])
@token_required
def rotas_do_motorista(id_user):
    conn = get_db_connection()
    try:
        rotas = conn.execute(
            """
            SELECT *
            FROM Rotas
            WHERE motorista_id = ?
            ORDER BY data DESC, horario DESC, id_rota DESC
            """,
            (id_user,),
        ).fetchall()

        resultado = []
        for rota in rotas:
            resultado.append(
                {
                    "id": rota["id_rota"],
                    "titulo": rota["nome_rota"],
                    "origem": rota["origem"] or "",
                    "destino": rota["destino"] or "",
                    "mapsUrl": rota["maps_url"],
                    "carga": rota["descricao"] or "",
                    "data": rota["data"],
                    "horario": rota["horario"],
                    "status": rota["status"] or "pendente",
                    "paradas": _paradas_da_rota(conn, int(rota["id_rota"])),
                }
            )

        return jsonify(resultado), 200
    finally:
        conn.close()


@rotas_bp.route("/rotas/<int:id_rota>", methods=["DELETE"])
@token_required
def deletar_rota(id_rota):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM Paradas WHERE id_rota = ?", (id_rota,))
        cursor = conn.execute("DELETE FROM Rotas WHERE id_rota = ?", (id_rota,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Rota nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@rotas_bp.route("/rotas/<int:id_rota>", methods=["PUT"])
@token_required
def atualizar_rota(id_rota):
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        atual = conn.execute("SELECT * FROM Rotas WHERE id_rota = ?", (id_rota,)).fetchone()
        if not atual:
            return jsonify({"status": "erro", "erro": "Rota nao encontrada"}), 404

        status = dados.get("status", atual["status"])
        if status not in VALID_STATUSES:
            return jsonify({"status": "erro", "erro": "Status invalido"}), 400

        conn.execute(
            """
            UPDATE Rotas
            SET nome_rota = ?,
                descricao = ?,
                origem = ?,
                destino = ?,
                maps_url = ?,
                motorista_id = ?,
                data = ?,
                horario = ?,
                status = ?
            WHERE id_rota = ?
            """,
            (
                dados.get("nome") or dados.get("nome_rota") or atual["nome_rota"],
                dados.get("observacoes") if "observacoes" in dados else dados.get("descricao", atual["descricao"]),
                dados.get("origem", atual["origem"]),
                dados.get("destino", atual["destino"]),
                dados.get("mapsUrl") if "mapsUrl" in dados else dados.get("maps_url", atual["maps_url"]),
                _int_or_none(dados.get("motoristaId") or dados.get("motorista_id")) or atual["motorista_id"],
                dados.get("data", atual["data"]),
                dados.get("horario", atual["horario"]),
                status,
                id_rota,
            ),
        )
        conn.commit()
        rota = conn.execute("SELECT * FROM Rotas WHERE id_rota = ?", (id_rota,)).fetchone()
        return jsonify(_rota_to_web(conn, rota)), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@rotas_bp.route("/rotas/<int:id_rota>/status", methods=["PATCH"])
@token_required
def atualizar_status_rota(id_rota):
    dados = request.get_json(silent=True) or {}
    status = dados.get("status")
    if status not in VALID_STATUSES:
        return jsonify({"status": "erro", "erro": "Status invalido"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "UPDATE Rotas SET status = ? WHERE id_rota = ?",
            (status, id_rota),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "erro": "Rota nao encontrada"}), 404
        return jsonify({"status": "sucesso", "rota_status": status}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()
