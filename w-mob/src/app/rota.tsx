import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFonts, Cinzel_400Regular } from "@expo-google-fonts/cinzel";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../services/api";

type Rota = {
  id: number;
  titulo: string;
  origem: string;
  destino: string;
  carga: string;
  mapsUrl?: string;
  data: string;
  horario: string;
  status: "pendente" | "em_andamento" | "finalizada" | "cancelada";
};

export default function RotaScreen() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Cinzel_400Regular });
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (!userData) return;
        const user = JSON.parse(userData);

        const response = await fetch(`${API_URL}/rota/${user.id}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });

        if (!response.ok) throw new Error("Erro na resposta");
        const data = await response.json();
        setRotas(data);
      } catch (error) {
        console.log("ERRO ROTA:", error);
        setRotas([]);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const abrirMapa = (rota: Rota) => {
    const url = rota.mapsUrl ||
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(rota.origem)}&destination=${encodeURIComponent(rota.destino)}`;
    Linking.openURL(url);
  };

  const corStatus = (status: string) => {
    if (status === "finalizada") return "#4caf50";
    if (status === "cancelada") return "#f44336";
    if (status === "em_andamento") return "#2196f3";
    return "#ff9800";
  };

  const labelStatus = (status: string) => {
    if (status === "finalizada") return "Finalizada";
    if (status === "cancelada") return "Cancelada";
    if (status === "em_andamento") return "Em andamento";
    return "Pendente";
  };

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando rotas...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <Text style={styles.logo}>WAEKIUM</Text>
      <View style={styles.divider} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Minhas Rotas</Text>
      </View>

      {rotas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhuma rota atribuída.</Text>
        </View>
      ) : (
        rotas.map((rota) => (
          <View key={rota.id} style={styles.card}>

            {/* Header do card */}
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitulo}>{rota.titulo}</Text>
              <View style={[styles.badge, { backgroundColor: corStatus(rota.status) + "22" }]}>
                <Text style={[styles.badgeText, { color: corStatus(rota.status) }]}>
                  {labelStatus(rota.status)}
                </Text>
              </View>
            </View>

            <View style={styles.dividerCard} />

            {/* Origem e destino */}
            <View style={styles.rotaInfo}>
              <View style={styles.rotaLinha}>
                <View style={[styles.rotaDot, { backgroundColor: "#4caf50" }]} />
                <Text style={styles.rotaTexto}>{rota.origem}</Text>
              </View>
              <View style={styles.rotaLinha}>
                <View style={[styles.rotaDot, { backgroundColor: "#f44336" }]} />
                <Text style={styles.rotaTexto}>{rota.destino}</Text>
              </View>
            </View>

            {/* Info extra */}
            {rota.carga ? (
              <Text style={styles.carga}>Carga: {rota.carga}</Text>
            ) : null}

            <Text style={styles.dataHora}>
              {rota.data} às {rota.horario}
            </Text>

            {/* Botão */}
            <TouchableOpacity style={styles.button} onPress={() => abrirMapa(rota)}>
              <Text style={styles.buttonText}>Abrir no Google Maps</Text>
            </TouchableOpacity>

          </View>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 15 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#999", fontSize: 15 },
  logo: { fontSize: 40, textAlign: "center", fontFamily: "Cinzel_400Regular" },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 22, fontWeight: "bold" },
  divider: { height: 1, backgroundColor: "#ddd", width: "90%", alignSelf: "center" },
  dividerCard: { height: 1, backgroundColor: "#eee", marginVertical: 8 },
  backButton: { width: 45, height: 45, backgroundColor: "#efefef", borderRadius: 50, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 26, fontWeight: "bold" },
  card: { backgroundColor: "#f5f5f5", borderRadius: 16, padding: 16, gap: 8 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitulo: { fontWeight: "bold", fontSize: 15, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  rotaInfo: { gap: 8 },
  rotaLinha: { flexDirection: "row", alignItems: "center", gap: 8 },
  rotaDot: { width: 10, height: 10, borderRadius: 5 },
  rotaTexto: { color: "#444", fontSize: 13, flex: 1 },
  carga: { color: "#777", fontSize: 12 },
  dataHora: { color: "#aaa", fontSize: 11 },
  button: { marginTop: 4, padding: 12, backgroundColor: "#000", borderRadius: 12, alignItems: "center" },
  buttonText: { fontWeight: "bold", color: "white", fontSize: 14 },
});
