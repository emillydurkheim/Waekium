// ==============================
// IMPORTAÇÕES
// ==============================

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../services/api";


// ==============================
// COMPONENTE PRINCIPAL
// ==============================

export default function FaceRecognitionScreen() {

  const router = useRouter();
  const cameraRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    requestPermission();
  }, []);

  // Permissão ainda carregando
  if (!permission) return null;

  // Permissão negada
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionText}>
          Permissão da câmera negada.
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={requestPermission}
        >
          <Text style={styles.retryText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }


  // ==============================
  // RECONHECIMENTO FACIAL
  // ==============================

  async function handleRecognition() {

    setScanning(true);

    try {

      // Pega usuário salvo
      const userStorage = await AsyncStorage.getItem("user");

      if (!userStorage) {
        Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
        router.replace("/");
        return;
      }

      const user = JSON.parse(userStorage);

      if (!cameraRef.current) {
        Alert.alert("Erro", "Câmera não encontrada.");
        return;
      }

      // ==============================
      // TIRA A FOTO
      // ==============================

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      // ==============================
      // MONTA O FORM DATA
      // ==============================
      // Rota esperada no Flask:
      // POST /validar-face
      // Body (multipart/form-data):
      //   image: arquivo jpg
      //   id_user: ID do usuário
      //
      // Flask deve comparar a foto recebida
      // com a foto salva do funcionário
      // usando a lib face_recognition
      //
      // Retorno esperado:
      // { sucesso: true } ou { sucesso: false, mensagem: "..." }

      const formData = new FormData();

      formData.append("image", {
        uri: photo.uri,
        name: "face.jpg",
        type: "image/jpeg",
      } as any);

      formData.append("id_user", String(user.id));

      // ==============================
      // ENVIA PARA O BACKEND
      // ==============================

      const response = await fetch(`${API_URL}/validar-face`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      // ==============================
      // RESULTADO
      // ==============================

      if (response.ok && data.sucesso) {

        // Vai direto para o ponto
        router.replace("/ponto");

      } else {

        Alert.alert(
          "Não reconhecido",
          data.mensagem || "Rosto não reconhecido. Tente novamente.",
          [{ text: "Tentar novamente" }]
        );
      }

    } catch (error) {
      console.log("ERRO FACIAL:", error);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setScanning(false);
    }
  }


  // ==============================
  // TELA
  // ==============================

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>

      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing="front"
      >
        <View style={styles.overlay}>

          {/* Topo */}
          <View style={styles.top}>
            <Text style={styles.heading}>Reconhecimento Facial</Text>
            <Text style={styles.subheading}>
              Posicione seu rosto dentro do círculo
            </Text>
          </View>

          {/* Guia oval do rosto */}
          <View style={styles.faceGuide} />

          {/* Botão */}
          <TouchableOpacity
            style={[
              styles.button,
              scanning && styles.buttonDisabled,
            ]}
            onPress={handleRecognition}
            disabled={scanning}
          >
            <Text style={styles.buttonText}>
              {scanning ? "Reconhecendo..." : "Iniciar reconhecimento"}
            </Text>
          </TouchableOpacity>

        </View>
      </CameraView>
    </View>
  );
}


// ==============================
// ESTILOS
// ==============================

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
    gap: 16,
  },
  permissionText: {
    color: "white",
    fontSize: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "white",
    borderRadius: 12,
  },
  retryText: {
    fontWeight: "bold",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 30,
    paddingBottom: 50,
  },
  top: {
    marginTop: 60,
  },
  heading: {
    color: "white",
    fontSize: 26,
    fontWeight: "700",
  },
  subheading: {
    color: "#aaa",
    marginTop: 8,
    fontSize: 14,
  },
  faceGuide: {
    alignSelf: "center",
    width: 260,
    height: 320,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.8)",
  },
  button: {
    backgroundColor: "white",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  buttonText: {
    fontWeight: "700",
    fontSize: 16,
    color: "#000",
  },
});