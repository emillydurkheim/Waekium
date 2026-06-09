from flask import Blueprint, jsonify, request

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

rh_bp = Blueprint("rh", __name__)


def _to_float(value, default=0.0):
    if value is None:
        return default
    text = str(value).strip().replace(",", ".")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _folha_to_dict(folha):
    return {
        "id_rh": folha["id_rh"],
        "id_funcionario": folha["id_funcionario"],
        "mes_referencia": folha["mes_referencia"],
        "salario_base": folha["salario_base"],
        "horas_trabalhadas": folha["horas_trabalhadas"],
        "horas_extras": folha["horas_extras"],
        "valor_hora_extra": folha["valor_hora_extra"],
        "descontos": folha["descontos"],
        "bonus": folha["bonus"],
        "salario_final": folha["salario_final"],
        "status_pagamento": folha["status_pagamento"],
    }


def _calcular_salario_final(
    salario_base: float,
    horas_extras: float,
    valor_hora_extra: float,
    descontos: float,
    bonus: float,
) -> float:
    return salario_base + (horas_extras * valor_hora_extra) + bonus - descontos


def _dados_folha(dados, funcionario):
    salario_base = _to_float(
        dados.get("salario_base"),
        _to_float(funcionario["salario"], 0.0),
    )
    horas_trabalhadas = _to_float(dados.get("horas_trabalhadas"))
    horas_extras = _to_float(dados.get("horas_extras"))
    valor_hora_extra = _to_float(dados.get("valor_hora_extra"))
    descontos = _to_float(dados.get("descontos"))
    bonus = _to_float(dados.get("bonus"))
    salario_final = _calcular_salario_final(
        salario_base,
        horas_extras,
        valor_hora_extra,
        descontos,
        bonus,
    )
    status_pagamento = dados.get("status_pagamento") or "pendente"
    return {
        "salario_base": salario_base,
        "horas_trabalhadas": horas_trabalhadas,
        "horas_extras": horas_extras,
        "valor_hora_extra": valor_hora_extra,
        "descontos": descontos,
        "bonus": bonus,
        "salario_final": salario_final,
        "status_pagamento": status_pagamento,
    }


@rh_bp.route("/rh/folha", methods=["POST"])
@token_required
def gerar_folha():
    dados = request.get_json(silent=True) or {}
    id_funcionario = dados.get("id_funcionario")
    mes_referencia = dados.get("mes_referencia")

    if not id_funcionario or not mes_referencia:
        return jsonify({"status": "erro", "mensagem": "id_funcionario e mes_referencia sao obrigatorios"}), 400

    conn = get_db_connection()
    try:
        funcionario = conn.execute(
            """
            SELECT f.id_funcionario, f.nome, fu.salario
            FROM Funcionario f
            JOIN funcoes fu ON f.id_funcao = fu.id_funcao
            WHERE f.id_funcionario = ?
            """,
            (id_funcionario,),
        ).fetchone()

        if not funcionario:
            return jsonify({"status": "erro", "mensagem": "Funcionario nao encontrado"}), 404

        folha = _dados_folha(dados, funcionario)
        conn.execute(
            """
            INSERT INTO RH (
                id_funcionario, mes_referencia, salario_base,
                horas_trabalhadas, horas_extras, valor_hora_extra,
                descontos, bonus, salario_final, status_pagamento
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id_funcionario, mes_referencia)
            DO UPDATE SET
                salario_base = excluded.salario_base,
                horas_trabalhadas = excluded.horas_trabalhadas,
                horas_extras = excluded.horas_extras,
                valor_hora_extra = excluded.valor_hora_extra,
                descontos = excluded.descontos,
                bonus = excluded.bonus,
                salario_final = excluded.salario_final,
                status_pagamento = excluded.status_pagamento
            """,
            (
                id_funcionario,
                mes_referencia,
                folha["salario_base"],
                folha["horas_trabalhadas"],
                folha["horas_extras"],
                folha["valor_hora_extra"],
                folha["descontos"],
                folha["bonus"],
                folha["salario_final"],
                folha["status_pagamento"],
            ),
        )
        conn.commit()

        row = conn.execute(
            """
            SELECT *
            FROM RH
            WHERE id_funcionario = ? AND mes_referencia = ?
            """,
            (id_funcionario, mes_referencia),
        ).fetchone()

        payload = _folha_to_dict(row)
        payload["status"] = "sucesso"
        return jsonify(payload), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()


@rh_bp.route("/rh/<int:id_funcionario>", methods=["GET"])
@token_required
def listar_rh(id_funcionario):
    conn = get_db_connection()
    try:
        folhas = conn.execute(
            """
            SELECT *
            FROM RH
            WHERE id_funcionario = ?
            ORDER BY mes_referencia DESC, id_rh DESC
            """,
            (id_funcionario,),
        ).fetchall()
        return jsonify([_folha_to_dict(folha) for folha in folhas]), 200
    finally:
        conn.close()


@rh_bp.route("/rh/folha/<int:id_rh>", methods=["PUT", "PATCH"])
@token_required
def editar_folha(id_rh):
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        atual = conn.execute("SELECT * FROM RH WHERE id_rh = ?", (id_rh,)).fetchone()
        if not atual:
            return jsonify({"status": "erro", "mensagem": "Folha nao encontrada"}), 404

        funcionario = conn.execute(
            """
            SELECT f.id_funcionario, f.nome, fu.salario
            FROM Funcionario f
            JOIN funcoes fu ON f.id_funcao = fu.id_funcao
            WHERE f.id_funcionario = ?
            """,
            (dados.get("id_funcionario") or atual["id_funcionario"],),
        ).fetchone()
        if not funcionario:
            return jsonify({"status": "erro", "mensagem": "Funcionario nao encontrado"}), 404

        merged = dict(atual)
        merged.update({key: value for key, value in dados.items() if value is not None})
        folha = _dados_folha(merged, funcionario)

        conn.execute(
            """
            UPDATE RH
            SET id_funcionario = ?,
                mes_referencia = ?,
                salario_base = ?,
                horas_trabalhadas = ?,
                horas_extras = ?,
                valor_hora_extra = ?,
                descontos = ?,
                bonus = ?,
                salario_final = ?,
                status_pagamento = ?
            WHERE id_rh = ?
            """,
            (
                merged["id_funcionario"],
                merged["mes_referencia"],
                folha["salario_base"],
                folha["horas_trabalhadas"],
                folha["horas_extras"],
                folha["valor_hora_extra"],
                folha["descontos"],
                folha["bonus"],
                folha["salario_final"],
                folha["status_pagamento"],
                id_rh,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM RH WHERE id_rh = ?", (id_rh,)).fetchone()
        payload = _folha_to_dict(row)
        payload["status"] = "sucesso"
        return jsonify(payload), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()


@rh_bp.route("/rh/<int:id_rh>", methods=["DELETE"])
@token_required
def deletar_folha(id_rh):
    conn = get_db_connection()
    try:
        cursor = conn.execute("DELETE FROM RH WHERE id_rh = ?", (id_rh,))
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify({"status": "erro", "mensagem": "Folha nao encontrada"}), 404
        return jsonify({"status": "sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
    finally:
        conn.close()
