from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

ponto_bp = Blueprint("ponto", __name__)

PUNCH_COLUMNS = {
    "entrada": "hor_entr",
    "saida_almoco": "hor_saida_almoco",
    "volta_almoco": "hor_volta_almoco",
    "retorno_almoco": "hor_volta_almoco",
    "saida": "hor_saida",
}

PUNCH_ORDER = ["entrada", "saida_almoco", "volta_almoco", "saida"]


def _date_today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _time_now() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _time_to_minutes(value: str | None) -> int | None:
    if not value:
        return None
    parts = value.split(":")
    if len(parts) < 2:
        return None
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except ValueError:
        return None


def _minutes_between(start: str | None, end: str | None) -> int:
    s = _time_to_minutes(start)
    e = _time_to_minutes(end)
    if s is None or e is None:
        return 0
    if e < s:
        e += 24 * 60
    return max(0, e - s)


def _ponto_to_batidas(row) -> dict:
    if not row:
        return {
            "entrada": None,
            "saida_almoco": None,
            "volta_almoco": None,
            "retorno_almoco": None,
            "saida": None,
        }
    return {
        "entrada": row["hor_entr"],
        "saida_almoco": row["hor_saida_almoco"],
        "volta_almoco": row["hor_volta_almoco"],
        "retorno_almoco": row["hor_volta_almoco"],
        "saida": row["hor_saida"],
    }


def _punches_from_row(id_user: int, row) -> list[dict]:
    if not row:
        return []
    date = row["data_entr"]
    items = [
        ("entrada", row["hor_entr"]),
        ("saida_almoco", row["hor_saida_almoco"]),
        ("volta_almoco", row["hor_volta_almoco"]),
        ("saida", row["hor_saida"]),
    ]
    punches = []
    for tipo, hora in items:
        if not hora:
            continue
        punches.append(
            {
                "id": f"{row['id_ponto']}:{tipo}",
                "employeeId": str(id_user),
                "type": tipo,
                "at": f"{date}T{hora}",
            }
        )
    return punches


def _worked_minutes(row) -> int:
    if not row:
        return 0
    total = _minutes_between(row["hor_entr"], row["hor_saida_almoco"])
    total += _minutes_between(row["hor_volta_almoco"], row["hor_saida"])
    if total == 0:
        total = _minutes_between(row["hor_entr"], row["hor_saida"])
    return total


def _day_summary(id_user: int, date: str, row, expected_minutes: int) -> dict:
    worked = _worked_minutes(row)
    return {
        "date": date,
        "employeeId": str(id_user),
        "punches": _punches_from_row(id_user, row),
        "workedMinutes": worked,
        "expectedMinutes": expected_minutes,
        "diffMinutes": worked - expected_minutes,
    }


def _next_tipo(row) -> str | None:
    batidas = _ponto_to_batidas(row)
    for tipo in PUNCH_ORDER:
        if not batidas.get(tipo):
            return tipo
    return None


def registrar_ponto(id_user: int, tipo: str | None = None, data: str | None = None, hora: str | None = None):
    data = data or _date_today()
    hora = hora or _time_now()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        ponto = cursor.execute(
            """
            SELECT *
            FROM Ponto
            WHERE id_user = ? AND data_entr = ?
            """,
            (id_user, data),
        ).fetchone()

        if not ponto:
            cursor.execute(
                """
                INSERT INTO Ponto (id_user, data_entr)
                VALUES (?, ?)
                """,
                (id_user, data),
            )
            id_ponto = int(cursor.lastrowid)
            ponto = cursor.execute("SELECT * FROM Ponto WHERE id_ponto = ?", (id_ponto,)).fetchone()
        else:
            id_ponto = int(ponto["id_ponto"])

        tipo_normalizado = "volta_almoco" if tipo == "retorno_almoco" else tipo
        if not tipo_normalizado:
            tipo_normalizado = _next_tipo(ponto)

        if not tipo_normalizado or tipo_normalizado not in PUNCH_COLUMNS:
            return {"status": "erro", "mensagem": "Ponto ja finalizado."}, 400

        coluna = PUNCH_COLUMNS[tipo_normalizado]
        ponto = cursor.execute("SELECT * FROM Ponto WHERE id_ponto = ?", (id_ponto,)).fetchone()
        if ponto[coluna]:
            return {"status": "erro", "mensagem": "Batida ja registrada."}, 409

        if coluna == "hor_saida":
            cursor.execute(
                "UPDATE Ponto SET data_saida = ?, hor_saida = ? WHERE id_ponto = ?",
                (data, hora, id_ponto),
            )
        else:
            cursor.execute(
                f"UPDATE Ponto SET {coluna} = ? WHERE id_ponto = ?",
                (hora, id_ponto),
            )

        conn.commit()
        return {
            "sucesso": True,
            "status": "sucesso",
            "tipo": tipo_normalizado,
            "hora_registrada": hora,
        }, 200
    except Exception as e:
        conn.rollback()
        return {"status": "erro", "mensagem": str(e)}, 500
    finally:
        conn.close()


@ponto_bp.route("/ponto", methods=["POST"])
@token_required
def bater_ponto():
    dados = request.get_json(silent=True) or {}
    id_user = dados.get("id_user")
    if not id_user:
        return jsonify({"status": "erro", "mensagem": "ID do usuario obrigatorio."}), 400

    resultado, status_code = registrar_ponto(
        int(id_user),
        dados.get("tipo"),
        dados.get("data"),
        dados.get("hora"),
    )
    return jsonify(resultado), status_code


@ponto_bp.route("/ponto/hoje/<int:id_user>", methods=["GET"])
@token_required
def ponto_hoje(id_user):
    conn = get_db_connection()
    try:
        data = request.args.get("data") or _date_today()
        ponto = conn.execute(
            """
            SELECT *
            FROM Ponto
            WHERE id_user = ? AND data_entr = ?
            """,
            (id_user, data),
        ).fetchone()
        return jsonify(_ponto_to_batidas(ponto)), 200
    finally:
        conn.close()


@ponto_bp.route("/ponto/historico/<int:id_user>", methods=["GET"])
@token_required
def historico_ponto(id_user):
    dias = int(request.args.get("dias", 14))
    expected = int(request.args.get("expected_minutes", 480))
    conn = get_db_connection()
    try:
        start = datetime.now().date() - timedelta(days=dias - 1)
        rows = conn.execute(
            """
            SELECT *
            FROM Ponto
            WHERE id_user = ? AND data_entr >= ?
            ORDER BY data_entr DESC
            """,
            (id_user, start.strftime("%Y-%m-%d")),
        ).fetchall()
        by_date = {row["data_entr"]: row for row in rows}
        summaries = []
        for offset in range(dias):
            date = (datetime.now().date() - timedelta(days=offset)).strftime("%Y-%m-%d")
            summaries.append(_day_summary(id_user, date, by_date.get(date), expected))
        return jsonify(summaries), 200
    finally:
        conn.close()


@ponto_bp.route("/ponto/banco/<int:id_user>", methods=["GET"])
@token_required
def banco_horas(id_user):
    dias = int(request.args.get("dias", 30))
    expected = int(request.args.get("expected_minutes", 480))
    conn = get_db_connection()
    try:
        start = datetime.now().date() - timedelta(days=dias - 1)
        rows = conn.execute(
            """
            SELECT *
            FROM Ponto
            WHERE id_user = ? AND data_entr >= ?
            """,
            (id_user, start.strftime("%Y-%m-%d")),
        ).fetchall()
        saldo = 0
        for row in rows:
            saldo += _worked_minutes(row) - expected
        return jsonify({"employeeId": str(id_user), "saldo_minutos": saldo}), 200
    finally:
        conn.close()


@ponto_bp.route("/horas-extras", methods=["GET"])
@token_required
def listar_horas_extras():
    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM HorasExtras
            ORDER BY criado_em DESC, id_hora_extra DESC
            """
        ).fetchall()
        return jsonify([_hora_extra_to_dict(row) for row in rows]), 200
    finally:
        conn.close()


@ponto_bp.route("/horas-extras", methods=["POST"])
@token_required
def solicitar_hora_extra():
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        if not dados.get("employeeId") or not dados.get("date") or not dados.get("hours"):
            return jsonify({"status": "erro", "mensagem": "employeeId, date e hours sao obrigatorios"}), 400

        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO HorasExtras (id_funcionario, data, horas, motivo, status)
            VALUES (?, ?, ?, ?, 'pendente')
            """,
            (
                dados["employeeId"],
                dados["date"],
                float(dados["hours"]),
                dados.get("reason"),
            ),
        )
        id_hora_extra = int(cursor.lastrowid)
        conn.commit()
        row = conn.execute(
            "SELECT * FROM HorasExtras WHERE id_hora_extra = ?",
            (id_hora_extra,),
        ).fetchone()
        return jsonify(_hora_extra_to_dict(row)), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()


@ponto_bp.route("/horas-extras/<int:id_hora_extra>", methods=["PATCH"])
@token_required
def revisar_hora_extra(id_hora_extra):
    dados = request.get_json(silent=True) or {}
    status = dados.get("status")
    if status not in {"aprovado", "rejeitado"}:
        return jsonify({"status": "erro", "mensagem": "Status invalido"}), 400

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            """
            UPDATE HorasExtras
            SET status = ?, revisado_em = CURRENT_TIMESTAMP, revisado_por = ?
            WHERE id_hora_extra = ?
            """,
            (status, dados.get("reviewerId"), id_hora_extra),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "mensagem": "Solicitacao nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()


@ponto_bp.route("/horas-extras/<int:id_hora_extra>", methods=["DELETE"])
@token_required
def deletar_hora_extra(id_hora_extra):
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM HorasExtras WHERE id_hora_extra = ?",
            (id_hora_extra,),
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "mensagem": "Solicitacao nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()


def _hora_extra_to_dict(row) -> dict:
    return {
        "id": str(row["id_hora_extra"]),
        "employeeId": str(row["id_funcionario"]),
        "date": row["data"],
        "hours": row["horas"],
        "reason": row["motivo"],
        "status": row["status"],
        "createdAt": int(datetime.fromisoformat(row["criado_em"].replace("Z", "")).timestamp() * 1000)
        if row["criado_em"]
        else 0,
        "reviewedAt": int(datetime.fromisoformat(row["revisado_em"].replace("Z", "")).timestamp() * 1000)
        if row["revisado_em"]
        else None,
        "reviewedBy": str(row["revisado_por"]) if row["revisado_por"] else None,
    }
