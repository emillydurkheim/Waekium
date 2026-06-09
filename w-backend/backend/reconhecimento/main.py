import face_recognition
import cv2
import os
from datetime import datetime

# ==========================
# CONFIGURAÇÕES
# ==========================
PASTA_FUNCIONARIOS = "funcionarios"
ARQUIVO_PONTO = "registro_ponto.csv"

# ==========================
# CARREGAR BIOMETRIA
# ==========================
def carregar_biometria():
    encodings_conhecidos = []
    nomes_conhecidos = []

    print("🔄 Carregando funcionários cadastrados...")

    if not os.path.exists(PASTA_FUNCIONARIOS):
        os.makedirs(PASTA_FUNCIONARIOS)
        print("📁 Pasta 'funcionarios' criada.")
        return encodings_conhecidos, nomes_conhecidos

    for arquivo in os.listdir(PASTA_FUNCIONARIOS):
        if arquivo.lower().endswith((".jpg", ".jpeg", ".png")):

            caminho = os.path.join(PASTA_FUNCIONARIOS, arquivo)

            try:
                img = face_recognition.load_image_file(caminho)
                encodings = face_recognition.face_encodings(img)

                if len(encodings) == 0:
                    print(f"⚠️ Nenhum rosto encontrado em {arquivo}")
                    continue

                encodings_conhecidos.append(encodings[0])
                nomes_conhecidos.append(os.path.splitext(arquivo)[0])

                print(f"✅ {arquivo} carregado com sucesso")

            except Exception as erro:
                print(f"❌ Erro ao carregar {arquivo}: {erro}")

    print(f"👥 Total de funcionários carregados: {len(nomes_conhecidos)}")
    return encodings_conhecidos, nomes_conhecidos

# ==========================
# REGISTRAR PONTO
# ==========================
def registrar_ponto(nome):
    agora = datetime.now()
    data_hora = agora.strftime("%d/%m/%Y %H:%M:%S")

    with open(ARQUIVO_PONTO, "a", encoding="utf-8") as arquivo:
        arquivo.write(f"{nome},{data_hora}\n")

    print(f"🟢 Ponto registrado: {nome} às {data_hora}")

# ==========================
# EXECUÇÃO PRINCIPAL
# ==========================
conhecidos_enc, conhecidos_nomes = carregar_biometria()

if len(conhecidos_enc) == 0:
    print("⚠️ Nenhum funcionário cadastrado.")
    print("Adicione fotos na pasta 'funcionarios'.")
    exit()

video_capture = cv2.VideoCapture(0)

if not video_capture.isOpened():
    print("❌ Não foi possível acessar a câmera.")
    exit()

ja_registrados = set()

print("📷 Câmera iniciada.")
print("Pressione Q para sair.")

while True:
    ret, frame = video_capture.read()

    if not ret:
        print("❌ Erro ao capturar vídeo.")
        break

    # Reduz imagem para processar mais rápido
    small_frame = cv2.resize(frame, (0, 0), fx=0.25, fy=0.25)

    # Converter BGR para RGB
    rgb_small_frame = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

    # Detectar rostos
    face_locations = face_recognition.face_locations(rgb_small_frame)
    face_encodings = face_recognition.face_encodings(
        rgb_small_frame,
        face_locations
    )

    for (top, right, bottom, left), face_encoding in zip(
        face_locations,
        face_encodings
    ):

        nome = "DESCONHECIDO"
        cor = (0, 0, 255)

        resultados = face_recognition.compare_faces(
            conhecidos_enc,
            face_encoding,
            tolerance=0.5
        )

        if True in resultados:
            indice = resultados.index(True)
            nome = conhecidos_nomes[indice]
            cor = (0, 255, 0)

            if nome not in ja_registrados:
                registrar_ponto(nome)
                ja_registrados.add(nome)

        # Ajustar coordenadas
        top *= 4
        right *= 4
        bottom *= 4
        left *= 4

        # Desenhar caixa
        cv2.rectangle(
            frame,
            (left, top),
            (right, bottom),
            cor,
            2
        )

        # Nome
        cv2.putText(
            frame,
            nome,
            (left, top - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            cor,
            2
        )

    cv2.imshow("Sistema de Ponto Inteligente", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# ==========================
# FINALIZAR
# ==========================
video_capture.release()
cv2.destroyAllWindows()
print("🔒 Sistema encerrado.")