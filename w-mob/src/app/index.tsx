import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useFonts, Cinzel_400Regular } from "@expo-google-fonts/cinzel";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../services/api";

export default function Index() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  const [fontsLoaded] = useFonts({ Cinzel_400Regular });

  const fazerLogin = async () => {
    if (!email || !senha) {
      Alert.alert("Atenção", "Preencha o e-mail e a senha.");
      return;
    }

    setCarregando(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Erro", data.mensagem || "E-mail ou senha inválidos.");
        return;
      }

      // ==============================
      // SALVA USUÁRIO LOCALMENTE
      // Flask retorna: { status, token, user: { id, nome, email, roles } }
      // ==============================
      await AsyncStorage.setItem(
        "user",
        JSON.stringify({
          id: data.user.id,
          nome: data.user.nome,
          cargo: data.user.roles?.[0] || "funcionario",
          token: data.token,
        })
      );

      router.push("/facial");

    } catch (error) {
      console.log("ERRO LOGIN:", error);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setCarregando(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View style={style.container}>
        <Text style={style.texter}>WAEKIUM</Text>
        <Text style={style.title}>Entrar</Text>
        <Text style={style.subtitle}>
          Acesse com o e-mail e senha fornecidos pela empresa.
        </Text>
        <View style={style.form}>
          <Input
            placeholder="E-mail corporativo"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            placeholder="Senha"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />
          <Button
            label={carregando ? "Entrando..." : "Entrar"}
            onPress={fazerLogin}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const style = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFD",
    padding: 50,
    justifyContent: "center",
    alignContent: "center",
  },
  texter: {
    fontSize: 70,
    textAlign: "center",
    fontFamily: "Cinzel_400Regular",
    marginBottom: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
  },
  form: {
    marginTop: 24,
    gap: 12,
  },
});