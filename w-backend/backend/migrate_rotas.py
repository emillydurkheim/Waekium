from backend.database import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN origem TEXT;")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN destino TEXT;")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN motorista_id TEXT;")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN maps_url TEXT;")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN status TEXT DEFAULT 'pendente';")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN data TEXT;")
except:
    pass

try:
    cursor.execute("ALTER TABLE Rotas ADD COLUMN horario TEXT;")
except:
    pass

conn.commit()
conn.close()

print("Migração concluída")