from flask import Blueprint, request, jsonify
import os, tempfile, numpy as np, cv2
from backend.database import get_db_connection

face_bp = Blueprint("face", __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PASTA_FOTOS = os.path.join(BASE_DIR, "..", "reconhecimento", "fotos")

try:
    import insightface
    from insightface.app import FaceAnalysis
    app_face = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
    app_face.prepare(ctx_id=0, det_size=(640, 640))
    FACE_REC_OK = True
    FACE_REC_ERROR = None
    print("InsightFace OK")
except Exception as e:
    print("InsightFace erro:", e)
    FACE_REC_OK = False
    FACE_REC_ERROR = str(e)

def extrair_embedding(caminho):
    img = cv2.imread(caminho)
    if img is None:
        raise ValueError("Imagem invalida")
    faces = app_face.get(img)
    if len(faces) == 0:
        return None
    face = max(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]))
    return face.embedding

def similaridade(e1, e2):
    n1 = e1 / np.linalg.norm(e1)
    n2 = e2 / np.linalg.norm(e2)
    return float(np.dot(n1, n2))

def validar_face(imagem_path, id_user):
    if not FACE_REC_OK:
        raise RuntimeError("Servico de reconhecimento indisponivel: " + (FACE_REC_ERROR or "erro desconhecido"))
    print("Buscando foto id_user=" + str(id_user))
    foto = None
    for ext in [".jpg", ".jpeg", ".png"]:
        c = os.path.join(PASTA_FOTOS, f"{id_user}{ext}")
        if os.path.exists(c):
            foto = c
            break
    if not foto:
        print("Foto nao encontrada")
        return False, "Foto do funcionario nao cadastrada."
    print("Foto encontrada: " + foto)
    try:
        e1 = extrair_embedding(foto)
        if e1 is None:
            return False, "Nenhum rosto na foto cadastrada."
        e2 = extrair_embedding(imagem_path)
        if e2 is None:
            return False, "Nenhum rosto detectado. Posicione melhor."
        sim = similaridade(e1, e2)
        print("Similaridade: " + str(round(sim, 4)))
        if sim >= 0.35:
            print("Reconhecido!")
            return True, ""
        else:
            print("NAO reconhecido")
            return False, "Rosto nao reconhecido."
    except Exception as e:
        print("Erro: " + str(e))
        return False, str(e)

@face_bp.route("/validar-face", methods=["POST"])
def validar_e_registrar():
    if not FACE_REC_OK:
        return jsonify({
            "sucesso": False,
            "mensagem": "Servico de reconhecimento indisponivel.",
            "erro": FACE_REC_ERROR,
        }), 503

    if "image" not in request.files:
        return jsonify({"sucesso": False, "mensagem": "Imagem nao enviada."}), 400
    file = request.files["image"]
    id_user = request.form.get("id_user")
    if not id_user:
        return jsonify({"sucesso": False, "mensagem": "ID nao enviado."}), 400
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp:
        file.save(temp.name)
        temp_path = temp.name
    try:
        reconhecido, motivo = validar_face(temp_path, id_user)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    if not reconhecido:
        return jsonify({"sucesso": False, "mensagem": motivo}), 401
    return jsonify({"sucesso": True, "mensagem": "Reconhecido!"}), 200
