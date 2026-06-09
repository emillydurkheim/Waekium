from backend.database import get_db_connection
from werkzeug.security import generate_password_hash

def corrigir_admin():
    conn = get_db_connection()
    cursor = conn.cursor()

    senha_hash = generate_password_hash("123")

    cursor.execute("""
        UPDATE Login
        SET senha = ?
        WHERE id_user = 1
    """, (senha_hash,))

    conn.commit()
    conn.close()

    print("✅ Admin corrigido com senha hash!")

if __name__ == "__main__":
    corrigir_admin()