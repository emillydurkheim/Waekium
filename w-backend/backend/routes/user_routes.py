import os
import sqlite3

from flask import Blueprint, jsonify, request
from PIL import Image
from werkzeug.security import generate_password_hash

from backend.database import get_db_connection
from backend.middleware.auth_middleware import token_required

user_bp = Blueprint("user", __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PASTA_FOTOS = os.path.abspath(os.path.join(BASE_DIR, "..", "reconhecimento", "fotos"))
os.makedirs(PASTA_FOTOS, exist_ok=True)


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


def _normalize_cpf(value: str | None) -> str | None:
    text = _clean(value)
    if text is None:
        return None
    return "".join(ch for ch in text if ch.isdigit())


def _sigla_estado(value: str | None) -> str | None:
    text = _clean(value)
    if text is None:
        return None
    text = text.replace("—", "-")
    if "-" in text:
        text = text.split("-")[-1]
    text = text.upper().strip()
    return text[:2] if len(text) >= 2 else None


def _buscar_ou_criar_estado(cursor, dados) -> int | None:
    id_est = _int_or_none(dados.get("id_est"))
    if id_est:
        row = cursor.execute("SELECT id_est FROM Estado WHERE id_est = ?", (id_est,)).fetchone()
        if row:
            return id_est

    sigla = _sigla_estado(dados.get("estado") or dados.get("sigla_estado"))
    if not sigla:
        return None

    row = cursor.execute("SELECT id_est FROM Estado WHERE sigla = ?", (sigla,)).fetchone()
    if row:
        return int(row["id_est"])

    nome = _clean(dados.get("nome_estado")) or sigla
    cursor.execute("INSERT INTO Estado (nome, sigla) VALUES (?, ?)", (nome, sigla))
    return int(cursor.lastrowid)


def _buscar_ou_criar_cidade(cursor, dados, id_est: int | None) -> int | None:
    id_cid = _int_or_none(dados.get("id_cid"))
    if id_cid:
        row = cursor.execute("SELECT id_cid FROM Cidade WHERE id_cid = ?", (id_cid,)).fetchone()
        if row:
            return id_cid

    cidade = _clean(dados.get("cidade"))
    if not cidade:
        base = _clean(dados.get("base"))
        if base:
            cidade = base.replace("—", "-").split("-")[0].strip()
    if not cidade:
        return None

    row = cursor.execute(
        "SELECT id_cid FROM Cidade WHERE cidade = ? AND (id_est = ? OR ? IS NULL)",
        (cidade, id_est, id_est),
    ).fetchone()
    if row:
        return int(row["id_cid"])

    cursor.execute("INSERT INTO Cidade (cidade, id_est) VALUES (?, ?)", (cidade, id_est))
    return int(cursor.lastrowid)


def salvar_foto_rgb(arquivo, caminho_destino: str):
    try:
        img = Image.open(arquivo)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(caminho_destino, "JPEG", quality=95)
    except Exception as e:
        raise ValueError(f"Erro ao processar imagem: {str(e)}") from e


def _funcionario_response(row):
    data = dict(row)
    id_funcionario = data.get("id_funcionario")
    data["tem_foto"] = os.path.exists(os.path.join(PASTA_FOTOS, f"{id_funcionario}.jpg"))
    return data


@user_bp.route("/cadastrar", methods=["POST"])
def rota_cadastrar():
    dados = request.form
    conn = None
    caminho_foto = None

    try:
        if "foto" not in request.files:
            return jsonify({"status": "erro", "campo": "foto", "erro": "Foto nao enviada"}), 400

        foto = request.files["foto"]
        senha = _clean(dados.get("senha"))
        nome = _clean(dados.get("nome"))
        cpf = _normalize_cpf(dados.get("cpf"))
        email = _clean(dados.get("email"))

        if not nome or not cpf or not email:
            return (
                jsonify(
                    {
                        "status": "erro",
                        "erro": "Nome, CPF e email sao obrigatorios",
                    }
                ),
                400,
            )
        if not senha:
            return jsonify({"status": "erro", "campo": "senha", "erro": "Senha nao enviada"}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        id_est = _buscar_ou_criar_estado(cursor, dados)
        id_cid = _buscar_ou_criar_cidade(cursor, dados, id_est)
        id_funcao = _int_or_none(dados.get("id_funcao")) or 1
        funcao = cursor.execute(
            "SELECT id_funcao FROM funcoes WHERE id_funcao = ?",
            (id_funcao,),
        ).fetchone()
        if not funcao:
            id_funcao = 1

        cursor.execute(
            """
            INSERT INTO Funcionario (
                nome, cpf, telefone, email, endereco, cep,
                id_cid, id_est, id_funcao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                nome,
                cpf,
                _clean(dados.get("telefone")),
                email,
                _clean(dados.get("endereco")),
                _clean(dados.get("cep")),
                id_cid,
                id_est,
                id_funcao,
            ),
        )

        id_funcionario = int(cursor.lastrowid)

        cursor.execute(
            """
            INSERT INTO Login (id_user, tipo_user, senha, senha_temporaria)
            VALUES (?, 2, ?, 1)
            """,
            (id_funcionario, generate_password_hash(senha)),
        )

        caminho_foto = os.path.join(PASTA_FOTOS, f"{id_funcionario}.jpg")
        salvar_foto_rgb(foto, caminho_foto)

        conn.commit()

        return (
            jsonify(
                {
                    "status": "sucesso",
                    "id_funcionario": id_funcionario,
                    "tem_foto": True,
                }
            ),
            201,
        )

    except sqlite3.IntegrityError as e:
        if conn:
            conn.rollback()
        if caminho_foto and os.path.exists(caminho_foto):
            os.remove(caminho_foto)
        return jsonify({"status": "erro", "erro": str(e)}), 409
    except Exception as e:
        if conn:
            conn.rollback()
        if caminho_foto and os.path.exists(caminho_foto):
            os.remove(caminho_foto)
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        if conn:
            conn.close()


@user_bp.route("/funcionarios/<int:id_funcionario>/foto", methods=["POST"])
@token_required
def atualizar_foto(id_funcionario):
    if "foto" not in request.files:
        return jsonify({"status": "erro", "erro": "Foto nao enviada"}), 400

    caminho_foto = os.path.join(PASTA_FOTOS, f"{id_funcionario}.jpg")
    try:
        salvar_foto_rgb(request.files["foto"], caminho_foto)
        return jsonify({"status": "sucesso", "mensagem": "Foto atualizada"}), 200
    except Exception as e:
        return jsonify({"status": "erro", "erro": str(e)}), 500


@user_bp.route("/funcionarios", methods=["GET"])
@token_required
def listar_funcionarios():
    conn = get_db_connection()
    try:
        funcionarios = conn.execute(
            """
            SELECT
                f.*,
                fu.nome_funcao,
                fu.salario AS salario_funcao,
                c.cidade,
                e.sigla AS estado
            FROM Funcionario f
            LEFT JOIN funcoes fu ON fu.id_funcao = f.id_funcao
            LEFT JOIN Cidade c ON c.id_cid = f.id_cid
            LEFT JOIN Estado e ON e.id_est = f.id_est
            ORDER BY f.nome
            """
        ).fetchall()
        return jsonify([_funcionario_response(f) for f in funcionarios]), 200
    except Exception as e:
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@user_bp.route("/funcionarios/<int:id_funcionario>", methods=["DELETE"])
@token_required
def excluir_funcionario(id_funcionario):
    conn = get_db_connection()
    try:
        conn.execute("DELETE FROM RH WHERE id_funcionario = ?", (id_funcionario,))
        conn.execute("DELETE FROM HorasExtras WHERE id_funcionario = ?", (id_funcionario,))
        conn.execute("DELETE FROM Agenda WHERE id_funcionario = ?", (id_funcionario,))
        conn.execute("DELETE FROM Ponto WHERE id_user = ?", (id_funcionario,))
        conn.execute("DELETE FROM Login WHERE id_user = ?", (id_funcionario,))
        conn.execute("DELETE FROM Funcionario WHERE id_funcionario = ?", (id_funcionario,))

        caminho_foto = os.path.join(PASTA_FOTOS, f"{id_funcionario}.jpg")
        if os.path.exists(caminho_foto):
            os.remove(caminho_foto)

        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Funcionario removido"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()


@user_bp.route("/funcionarios/<int:id_funcionario>", methods=["PUT"])
@token_required
def editar_funcionario(id_funcionario):
    dados = request.get_json(silent=True) or {}
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        atual = cursor.execute(
            "SELECT * FROM Funcionario WHERE id_funcionario = ?",
            (id_funcionario,),
        ).fetchone()
        if not atual:
            return jsonify({"status": "erro", "erro": "Funcionario nao encontrado"}), 404

        id_est = _buscar_ou_criar_estado(cursor, dados)
        if id_est is None and "id_est" not in dados and "estado" not in dados:
            id_est = atual["id_est"]

        id_cid = _buscar_ou_criar_cidade(cursor, dados, id_est)
        if id_cid is None and "id_cid" not in dados and "cidade" not in dados:
            id_cid = atual["id_cid"]

        id_funcao = _int_or_none(dados.get("id_funcao")) or atual["id_funcao"]

        cursor.execute(
            """
            UPDATE Funcionario
            SET nome = ?,
                cpf = ?,
                telefone = ?,
                email = ?,
                endereco = ?,
                cep = ?,
                id_cid = ?,
                id_est = ?,
                id_funcao = ?,
                ativo = ?
            WHERE id_funcionario = ?
            """,
            (
                _clean(dados.get("nome")) or atual["nome"],
                _normalize_cpf(dados.get("cpf")) or atual["cpf"],
                _clean(dados.get("telefone")),
                _clean(dados.get("email")) or atual["email"],
                _clean(dados.get("endereco")),
                _clean(dados.get("cep")),
                id_cid,
                id_est,
                id_funcao,
                int(dados.get("ativo", atual["ativo"])),
                id_funcionario,
            ),
        )
        conn.commit()
        return jsonify({"status": "sucesso", "mensagem": "Atualizado com sucesso"}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "erro", "erro": str(e)}), 500
    finally:
        conn.close()
