import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useFonts, Cinzel_400Regular } from "@expo-google-fonts/cinzel";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../services/api";

// ==============================
// TIPOS
// ==============================

type ItemAgenda = {
  id: number;
  hora: string;
  titulo: string;
  descricao?: string;
};

type AgendaApi = {
  id_agenda: number;
  horario: string | null;
  titulo: string;
  descricao: string | null;
  data: string;
  status: string;
};

// ==============================
// COMPONENTE
// ==============================

export default function Agenda() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Cinzel_400Regular });
  const [agenda, setAgenda] = useState<ItemAgenda[]>([]);
  const [loading, setLoading] = useState(true);

  // ==============================
  // BUSCAR AGENDA DO BACKEND
  // ==============================
  // Rota esperada no Flask:
  // GET /agenda/:id_user
  // Headers: Authorization: Bearer <token>
  // Retorno esperado:
  // [
  //   { id: 1, hora: "08:00", titulo: "Checklist Veículo", descricao: "..." },
  //   ...
  // ]

  const carregarAgenda = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (!userData) return;

      const user = JSON.parse(userData);

      const response = await fetch(`${API_URL}/agenda/${user.id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) throw new Error("Erro na resposta");

      const data = (await response.json()) as AgendaApi[];
      const hoje = new Date().toISOString().split("T")[0];
      setAgenda(
        data
          .filter((item) => item.data === hoje && item.status !== "cancelado")
          .map((item) => ({
            id: item.id_agenda,
            hora: item.horario || "",
            titulo: item.titulo,
            descricao: item.descricao || undefined,
          })),
      );

    } catch (error) {
      console.log("ERRO AO BUSCAR AGENDA:", error);
      // Fallback: mostra vazio com mensagem
      setAgenda([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAgenda();
  }, []);

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando agenda...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <Text style={styles.logo}>WAEKIUM</Text>
      <View style={styles.divider} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Minha Agenda</Text>
      </View>

      {/* Timeline */}
      {agenda.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhum compromisso para hoje.
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {agenda.map((item, index) => (
            <View key={item.id} style={styles.item}>
              <View style={styles.timelineLeft}>
                <View style={styles.dot} />
                {index < agenda.length - 1 && (
                  <View style={styles.line} />
                )}
              </View>
              <View style={styles.info}>
                <Text style={styles.hora}>{item.hora}</Text>
                <View>
                  <Text style={styles.titulo}>{item.titulo}</Text>
                  {item.descricao ? (
                    <Text style={styles.descricao}>{item.descricao}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.divider} />

    </ScrollView>
  );
}

// ==============================
// ESTILOS
// ==============================

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    fontSize: 15,
  },
  logo: {
    fontSize: 40,
    textAlign: "center",
    fontFamily: "Cinzel_400Regular",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    width: "90%",
    alignSelf: "center",
  },
  backButton: {
    width: 45,
    height: 45,
    backgroundColor: "#efefef",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: {
    fontSize: 26,
    fontWeight: "bold",
  },
  timeline: {
    marginTop: 8,
    gap: 0,
  },
  item: {
    flexDirection: "row",
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: 14,
    width: 16,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#818181",
    marginTop: 4,
    marginLeft: 100,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#ddd",
    marginVertical: 4,
    minHeight: 30,
  },
  info: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    paddingBottom: 16,
  },
  hora: {
    fontWeight: "bold",
    fontSize: 14,
    minWidth: 46,
  },
  titulo: {
    color: "#333",
    marginTop: 2,
    fontSize: 17,
    fontWeight: "500",
  },
  descricao: {
    color: "#999",
    fontSize: 12,
    marginTop: 2,
  },
  card: {
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 19,
    gap: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 16,
  },
  button: {
    marginTop: 4,
    padding: 10,
    backgroundColor: "#e0e0e0",
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "bold",
  },
});
