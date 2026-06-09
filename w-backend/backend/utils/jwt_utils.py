import jwt
import datetime

CHAVE = "chave_secreta_para_jwt" 

def gerar_token(user_id, tipo_user):
    payload = {
        "user_id": user_id,
        "tipo_user": tipo_user,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2) # O token expira em 2 horas
    }

    token = jwt.encode(payload, CHAVE, algorithm="HS256")
    return token


def verificar_token(token):
    try:
        payload = jwt.decode(token, CHAVE, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return {"erro": "Token expirado"}
    except jwt.InvalidTokenError:
        return {"erro": "Token inválido"}