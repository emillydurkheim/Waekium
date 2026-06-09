import os
import sqlite3
from datetime import datetime
from typing import Any

from werkzeug.security import generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 10000;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    return conn


def _table_exists(cursor: sqlite3.Cursor, table: str) -> bool:
    return (
        cursor.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        is not None
    )


def _columns(cursor: sqlite3.Cursor, table: str) -> list[str]:
    return [row["name"] for row in cursor.execute(f"PRAGMA table_info({table})")]


def _row_value(row: sqlite3.Row | dict[str, Any], key: str, default: Any = None) -> Any:
    if isinstance(row, sqlite3.Row):
        return row[key] if key in row.keys() else default
    return row.get(key, default)


def _to_int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    text = str(value).strip().replace(",", ".")
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        return default


def _create_rh_table(cursor: sqlite3.Cursor, table: str = "RH"):
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table} (
            id_rh INTEGER PRIMARY KEY AUTOINCREMENT,
            id_funcionario INTEGER NOT NULL,
            mes_referencia TEXT NOT NULL,
            salario_base REAL DEFAULT 0,
            horas_trabalhadas REAL DEFAULT 0,
            horas_extras REAL DEFAULT 0,
            valor_hora_extra REAL DEFAULT 0,
            descontos REAL DEFAULT 0,
            bonus REAL DEFAULT 0,
            salario_final REAL DEFAULT 0,
            status_pagamento TEXT DEFAULT 'pendente',
            UNIQUE(id_funcionario, mes_referencia),
            FOREIGN KEY (id_funcionario)
                REFERENCES Funcionario(id_funcionario)
                ON DELETE CASCADE
        );
        """
    )


def _create_rotas_table(cursor: sqlite3.Cursor, table: str = "Rotas"):
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table} (
            id_rota INTEGER PRIMARY KEY AUTOINCREMENT,
            id_agenda INTEGER NOT NULL,
            nome_rota TEXT NOT NULL,
            descricao TEXT,
            ordem INTEGER,
            origem TEXT,
            destino TEXT,
            motorista_id INTEGER,
            maps_url TEXT,
            status TEXT DEFAULT 'pendente',
            data TEXT,
            horario TEXT,
            FOREIGN KEY (id_agenda)
                REFERENCES Agenda(id_agenda)
                ON DELETE CASCADE
        );
        """
    )


def _create_paradas_table(cursor: sqlite3.Cursor, table: str = "Paradas"):
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table} (
            id_parada INTEGER PRIMARY KEY AUTOINCREMENT,
            id_rota INTEGER NOT NULL,
            nome_local TEXT NOT NULL,
            endereco TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            horario TEXT,
            status TEXT DEFAULT 'pendente',
            ordem INTEGER,
            FOREIGN KEY (id_rota)
                REFERENCES Rotas(id_rota)
                ON DELETE CASCADE
        );
        """
    )


def _ensure_admin_agenda(cursor: sqlite3.Cursor) -> int:
    row = cursor.execute("SELECT id_agenda FROM Agenda WHERE id_agenda = 1").fetchone()
    if row:
        return int(row["id_agenda"])

    cursor.execute(
        """
        INSERT INTO Agenda (
            id_agenda, id_funcionario, tipo, titulo, descricao,
            endereco, data, horario, status, criado_por
        )
        VALUES (1, 1, 'sistema', 'Agenda padrão', 'Agenda criada para rotas legadas',
                'Local não especificado', ?, NULL, 'pendente', 1)
        """,
        (datetime.now().strftime("%Y-%m-%d"),),
    )
    return 1


def _ensure_agenda_for_rota(cursor: sqlite3.Cursor, rota: sqlite3.Row) -> int:
    raw_id = _to_int_or_none(_row_value(rota, "id_agenda"))
    if raw_id:
        found = cursor.execute(
            "SELECT id_agenda FROM Agenda WHERE id_agenda = ?",
            (raw_id,),
        ).fetchone()
        if found:
            return raw_id

    motorista_id = _to_int_or_none(_row_value(rota, "motorista_id")) or 1
    funcionario = cursor.execute(
        "SELECT id_funcionario FROM Funcionario WHERE id_funcionario = ?",
        (motorista_id,),
    ).fetchone()
    if not funcionario:
        motorista_id = 1

    data = str(_row_value(rota, "data") or datetime.now().strftime("%Y-%m-%d"))
    titulo = str(_row_value(rota, "nome_rota") or "Rota")
    endereco = str(_row_value(rota, "destino") or _row_value(rota, "origem") or "Local não especificado")

    cursor.execute(
        """
        INSERT INTO Agenda (
            id_funcionario, tipo, titulo, descricao,
            endereco, data, horario, status, criado_por
        )
        VALUES (?, 'rota', ?, ?, ?, ?, ?, 'pendente', 1)
        """,
        (
            motorista_id,
            titulo,
            _row_value(rota, "descricao"),
            endereco,
            data,
            _row_value(rota, "horario"),
        ),
    )
    return int(cursor.lastrowid)


def _normalize_foreign_keys(cursor: sqlite3.Cursor):
    cursor.executescript(
        """
        UPDATE Funcionario
        SET id_cid = NULL
        WHERE id_cid IS NULL
           OR TRIM(CAST(id_cid AS TEXT)) = ''
           OR NOT EXISTS (
                SELECT 1 FROM Cidade c WHERE c.id_cid = Funcionario.id_cid
           );

        UPDATE Funcionario
        SET id_est = NULL
        WHERE id_est IS NULL
           OR TRIM(CAST(id_est AS TEXT)) = ''
           OR NOT EXISTS (
                SELECT 1 FROM Estado e WHERE e.id_est = Funcionario.id_est
           );

        UPDATE Funcionario
        SET id_funcao = 1
        WHERE id_funcao IS NULL
           OR TRIM(CAST(id_funcao AS TEXT)) = ''
           OR NOT EXISTS (
                SELECT 1 FROM funcoes f WHERE f.id_funcao = Funcionario.id_funcao
           );

        UPDATE Cidade
        SET id_est = NULL
        WHERE id_est IS NULL
           OR TRIM(CAST(id_est AS TEXT)) = ''
           OR NOT EXISTS (
                SELECT 1 FROM Estado e WHERE e.id_est = Cidade.id_est
           );

        DELETE FROM Login
        WHERE id_user NOT IN (
            SELECT id_funcionario FROM Funcionario
        );

        UPDATE Login
        SET tipo_user = 2
        WHERE tipo_user NOT IN (
            SELECT id_tipo FROM Tipo_User
        );

        DELETE FROM Ponto
        WHERE id_user IS NOT NULL
          AND id_user NOT IN (
            SELECT id_user FROM Login
          );

        UPDATE Agenda
        SET criado_por = NULL
        WHERE criado_por IS NOT NULL
          AND criado_por NOT IN (
            SELECT id_funcionario FROM Funcionario
          );

        DELETE FROM Agenda
        WHERE id_funcionario NOT IN (
            SELECT id_funcionario FROM Funcionario
        );
        """
    )


def _migrate_rh(cursor: sqlite3.Cursor):
    if not _table_exists(cursor, "RH"):
        _create_rh_table(cursor)
        return

    current_cols = _columns(cursor, "RH")
    expected_cols = [
        "id_rh",
        "id_funcionario",
        "mes_referencia",
        "salario_base",
        "horas_trabalhadas",
        "horas_extras",
        "valor_hora_extra",
        "descontos",
        "bonus",
        "salario_final",
        "status_pagamento",
    ]
    fks = list(cursor.execute("PRAGMA foreign_key_list(RH)"))
    fk_ok = any(
        fk["table"] == "Funcionario"
        and fk["from"] == "id_funcionario"
        and fk["to"] == "id_funcionario"
        for fk in fks
    )
    needs_rebuild = current_cols != expected_cols or not fk_ok

    if not needs_rebuild:
        cursor.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_funcionario_mes ON RH(id_funcionario, mes_referencia)"
        )
        return

    old_rows = list(cursor.execute("SELECT * FROM RH"))
    funcionarios = {
        int(row["id_funcionario"])
        for row in cursor.execute("SELECT id_funcionario FROM Funcionario")
    }

    cursor.execute("ALTER TABLE RH RENAME TO RH_old")
    _create_rh_table(cursor)

    latest: dict[tuple[int, str], dict[str, Any]] = {}
    for row in old_rows:
        data = dict(row)
        id_funcionario = _to_int_or_none(data.get("id_funcionario")) or _to_int_or_none(
            data.get("id_func")
        )
        mes_referencia = str(data.get("mes_referencia") or "").strip()
        if not id_funcionario or id_funcionario not in funcionarios or not mes_referencia:
            continue

        salario_base = _to_float(data.get("salario_base"))
        horas_trabalhadas = _to_float(data.get("horas_trabalhadas") or data.get("horas"))
        horas_extras = _to_float(data.get("horas_extras"))
        valor_hora_extra = _to_float(data.get("valor_hora_extra") or data.get("valor_hora"))
        descontos = _to_float(data.get("descontos"))
        bonus = _to_float(data.get("bonus"))
        salario_final = salario_base + (horas_extras * valor_hora_extra) + bonus - descontos

        normalized = {
            "id_rh": _to_int_or_none(data.get("id_rh")) or 0,
            "id_funcionario": id_funcionario,
            "mes_referencia": mes_referencia,
            "salario_base": salario_base,
            "horas_trabalhadas": horas_trabalhadas,
            "horas_extras": horas_extras,
            "valor_hora_extra": valor_hora_extra,
            "descontos": descontos,
            "bonus": bonus,
            "salario_final": salario_final,
            "status_pagamento": data.get("status_pagamento") or "pendente",
        }
        key = (id_funcionario, mes_referencia)
        if key not in latest or normalized["id_rh"] > latest[key]["id_rh"]:
            latest[key] = normalized

    for item in latest.values():
        cursor.execute(
            """
            INSERT INTO RH (
                id_funcionario, mes_referencia, salario_base,
                horas_trabalhadas, horas_extras, valor_hora_extra,
                descontos, bonus, salario_final, status_pagamento
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id_funcionario"],
                item["mes_referencia"],
                item["salario_base"],
                item["horas_trabalhadas"],
                item["horas_extras"],
                item["valor_hora_extra"],
                item["descontos"],
                item["bonus"],
                item["salario_final"],
                item["status_pagamento"],
            ),
        )

    cursor.execute("DROP TABLE RH_old")


def _migrate_rotas_paradas(cursor: sqlite3.Cursor):
    rotas_exist = _table_exists(cursor, "Rotas")
    paradas_exist = _table_exists(cursor, "Paradas")
    rotas_cols = _columns(cursor, "Rotas") if rotas_exist else []
    paradas_cols = _columns(cursor, "Paradas") if paradas_exist else []
    paradas_fk = list(cursor.execute("PRAGMA foreign_key_list(Paradas)")) if paradas_exist else []
    cascade_ok = any(
        fk["table"] == "Rotas"
        and fk["from"] == "id_rota"
        and fk["on_delete"].upper() == "CASCADE"
        for fk in paradas_fk
    )

    expected_rotas = [
        "id_rota",
        "id_agenda",
        "nome_rota",
        "descricao",
        "ordem",
        "origem",
        "destino",
        "motorista_id",
        "maps_url",
        "status",
        "data",
        "horario",
    ]
    expected_paradas = [
        "id_parada",
        "id_rota",
        "nome_local",
        "endereco",
        "latitude",
        "longitude",
        "horario",
        "status",
        "ordem",
    ]

    if rotas_cols == expected_rotas and paradas_cols == expected_paradas and cascade_ok:
        return

    rotas = list(cursor.execute("SELECT * FROM Rotas")) if rotas_exist else []
    paradas = list(cursor.execute("SELECT * FROM Paradas")) if paradas_exist else []

    if paradas_exist:
        cursor.execute("DROP TABLE Paradas")
    if rotas_exist:
        cursor.execute("DROP TABLE Rotas")

    _create_rotas_table(cursor)
    _create_paradas_table(cursor)

    id_map: dict[int, int] = {}
    _ensure_admin_agenda(cursor)

    for rota in rotas:
        old_id = _to_int_or_none(_row_value(rota, "id_rota"))
        id_agenda = _ensure_agenda_for_rota(cursor, rota)
        motorista_id = _to_int_or_none(_row_value(rota, "motorista_id"))
        cursor.execute(
            """
            INSERT INTO Rotas (
                id_agenda, nome_rota, descricao, ordem, origem, destino,
                motorista_id, maps_url, status, data, horario
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                id_agenda,
                _row_value(rota, "nome_rota") or "Rota",
                _row_value(rota, "descricao"),
                _to_int_or_none(_row_value(rota, "ordem")),
                _row_value(rota, "origem"),
                _row_value(rota, "destino"),
                motorista_id,
                _row_value(rota, "maps_url"),
                _row_value(rota, "status") or "pendente",
                _row_value(rota, "data"),
                _row_value(rota, "horario"),
            ),
        )
        if old_id:
            id_map[old_id] = int(cursor.lastrowid)

    for parada in paradas:
        old_rota_id = _to_int_or_none(_row_value(parada, "id_rota"))
        new_rota_id = id_map.get(old_rota_id or 0)
        if not new_rota_id:
            continue
        nome_local = str(_row_value(parada, "nome_local") or "").strip()
        endereco = str(_row_value(parada, "endereco") or "").strip()
        if not nome_local or not endereco:
            continue
        cursor.execute(
            """
            INSERT INTO Paradas (
                id_rota, nome_local, endereco, latitude, longitude,
                horario, status, ordem
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                new_rota_id,
                nome_local,
                endereco,
                _row_value(parada, "latitude"),
                _row_value(parada, "longitude"),
                _row_value(parada, "horario"),
                _row_value(parada, "status") or "pendente",
                _to_int_or_none(_row_value(parada, "ordem")),
            ),
        )


def run_migrations():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 10000;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = OFF;")

    try:
        cursor = conn.cursor()
        cursor.execute("BEGIN")
        _normalize_foreign_keys(cursor)
        _migrate_rh(cursor)
        _migrate_rotas_paradas(cursor)
        _normalize_foreign_keys(cursor)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.close()

    conn = get_db_connection()
    try:
        rows = conn.execute("PRAGMA foreign_key_check").fetchall()
        if rows:
            raise RuntimeError(f"foreign_key_check retornou inconsistencias: {rows}")
    finally:
        conn.close()


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.executescript(
            """
            CREATE TABLE IF NOT EXISTS Estado (
                id_est INTEGER PRIMARY KEY AUTOINCREMENT,
                nome VARCHAR(20) NOT NULL,
                sigla VARCHAR(2) NOT NULL
            );

            CREATE TABLE IF NOT EXISTS Cidade (
                id_cid INTEGER PRIMARY KEY AUTOINCREMENT,
                cidade VARCHAR(30) NOT NULL,
                id_est INTEGER,
                FOREIGN KEY (id_est) REFERENCES Estado(id_est)
            );

            CREATE TABLE IF NOT EXISTS Tipo_User (
                id_tipo INTEGER PRIMARY KEY AUTOINCREMENT,
                nome_tipo TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS funcoes (
                id_funcao INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,
                nome_funcao TEXT NOT NULL UNIQUE,
                salario REAL NOT NULL,
                carga_horaria_semanal INTEGER DEFAULT 44,
                ativo INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS Funcionario (
                id_funcionario INTEGER PRIMARY KEY AUTOINCREMENT,
                nome VARCHAR(100) NOT NULL,
                cpf VARCHAR(11) UNIQUE NOT NULL,
                telefone VARCHAR(15),
                email VARCHAR(100) UNIQUE NOT NULL,
                endereco VARCHAR(150),
                cep VARCHAR(10),
                id_cid INTEGER,
                id_est INTEGER,
                id_funcao INTEGER NOT NULL,
                banco_horas_ativo INTEGER DEFAULT 0,
                ativo INTEGER DEFAULT 1,
                FOREIGN KEY (id_cid) REFERENCES Cidade(id_cid),
                FOREIGN KEY (id_est) REFERENCES Estado(id_est),
                FOREIGN KEY (id_funcao) REFERENCES funcoes(id_funcao)
            );

            CREATE TABLE IF NOT EXISTS Login (
                id_user INTEGER PRIMARY KEY,
                tipo_user INTEGER NOT NULL,
                ultimo_login TEXT,
                ativo INTEGER DEFAULT 1,
                senha TEXT NOT NULL,
                senha_temporaria INTEGER DEFAULT 1,
                FOREIGN KEY (id_user) REFERENCES Funcionario(id_funcionario),
                FOREIGN KEY (tipo_user) REFERENCES Tipo_User(id_tipo)
            );

            CREATE TABLE IF NOT EXISTS Jornada (
                id_forn INTEGER PRIMARY KEY AUTOINCREMENT,
                nome VARCHAR(50),
                id_cid INTEGER,
                id_est INTEGER,
                FOREIGN KEY (id_cid) REFERENCES Cidade(id_cid),
                FOREIGN KEY (id_est) REFERENCES Estado(id_est)
            );

            CREATE TABLE IF NOT EXISTS Ponto (
                id_ponto INTEGER PRIMARY KEY AUTOINCREMENT,
                id_user INTEGER,
                data_entr DATE,
                data_saida DATE,
                hor_entr TIME,
                hor_saida_almoco TIME,
                hor_volta_almoco TIME,
                hor_saida TIME,
                FOREIGN KEY (id_user) REFERENCES Login(id_user)
            );

            CREATE TABLE IF NOT EXISTS Atividade (
                id_atividade INTEGER PRIMARY KEY AUTOINCREMENT,
                descricao TEXT
            );

            CREATE TABLE IF NOT EXISTS Agenda (
                id_agenda INTEGER PRIMARY KEY AUTOINCREMENT,
                id_funcionario INTEGER NOT NULL,
                tipo TEXT NOT NULL,
                titulo TEXT NOT NULL,
                descricao TEXT,
                endereco TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                data TEXT NOT NULL,
                horario TEXT,
                status TEXT DEFAULT 'pendente',
                criado_por INTEGER,
                FOREIGN KEY (id_funcionario) REFERENCES Funcionario(id_funcionario),
                FOREIGN KEY (criado_por) REFERENCES Funcionario(id_funcionario)
            );

            CREATE TABLE IF NOT EXISTS HorasExtras (
                id_hora_extra INTEGER PRIMARY KEY AUTOINCREMENT,
                id_funcionario INTEGER NOT NULL,
                data TEXT NOT NULL,
                horas REAL NOT NULL,
                motivo TEXT,
                status TEXT DEFAULT 'pendente',
                criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
                revisado_em TEXT,
                revisado_por INTEGER,
                FOREIGN KEY (id_funcionario)
                    REFERENCES Funcionario(id_funcionario)
                    ON DELETE CASCADE,
                FOREIGN KEY (revisado_por)
                    REFERENCES Funcionario(id_funcionario)
            );
            """
        )

        _create_rh_table(cursor)
        _create_rotas_table(cursor)
        _create_paradas_table(cursor)

        cursor.execute(
            "INSERT OR IGNORE INTO Tipo_User (id_tipo, nome_tipo) VALUES (1, 'Administrador')"
        )
        cursor.execute(
            "INSERT OR IGNORE INTO Tipo_User (id_tipo, nome_tipo) VALUES (2, 'Funcionario')"
        )
        cursor.execute(
            "INSERT OR IGNORE INTO Tipo_User (id_tipo, nome_tipo) VALUES (3, 'AdministradorFuncionario')"
        )

        cursor.execute(
            "INSERT OR IGNORE INTO Estado (id_est, nome, sigla) VALUES (1, 'Sao Paulo', 'SP')"
        )
        cursor.execute(
            "INSERT OR IGNORE INTO Cidade (id_cid, cidade, id_est) VALUES (1, 'Campinas', 1)"
        )

        cursor.execute(
            """
            INSERT OR IGNORE INTO funcoes (id_funcao, nome_funcao, salario, carga_horaria_semanal)
            VALUES (1, 'Motorista', 3500, 44)
            """
        )
        cursor.execute(
            """
            INSERT OR IGNORE INTO funcoes (id_funcao, nome_funcao, salario, carga_horaria_semanal)
            VALUES (2, 'Assistente Administrativo', 2500, 44)
            """
        )
        cursor.execute(
            """
            INSERT OR IGNORE INTO funcoes (id_funcao, nome_funcao, salario, carga_horaria_semanal)
            VALUES (3, 'Gerente', 6000, 44)
            """
        )

        cursor.execute(
            """
            INSERT OR IGNORE INTO Funcionario
            (id_funcionario, nome, cpf, email, id_funcao)
            VALUES (1, 'Admin', '12345678901', 'admin@email.com', 1)
            """
        )
        cursor.execute(
            """
            INSERT OR IGNORE INTO Login (id_user, tipo_user, senha)
            VALUES (1, 1, ?)
            """,
            (generate_password_hash("123"),),
        )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    run_migrations()


if __name__ == "__main__":
    init_db()
