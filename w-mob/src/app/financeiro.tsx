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

type Pagamento = {
  id_rh: number;
  mes_referencia: string;
  salario_base: number;
  salario_final: number;
  horas_trabalhadas: number;
  horas_extras: number;
  descontos: number;
  bonus: number;
  status_pagamento: string;
};

function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function Financeiro() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Cinzel_400Regular });
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregar = async () => {
      try {
        const userStorage = await AsyncStorage.getItem("user");
        if (!userStorage) return;
        const user = JSON.parse(userStorage);

        // Usa a rota correta do Flask: /rh/:id
        const response = await fetch(`${API_URL}/rh/${user.id}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });

        if (!response.ok) throw new Error("Erro na resposta");
        const data = await response.json();
        console.log("RESPOSTA FINANCEIRO:", JSON.stringify(data));
        setPagamentos(data);
      } catch (error) {
        console.log("ERRO FINANCEIRO:", error);
        setPagamentos([]);
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  if (!fontsLoaded) return null;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando financeiro...</Text>
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
        <Text style={styles.title}>Financeiro</Text>
      </View>

      <Text style={styles.subtitle}>Folha de Pagamento</Text>

      {pagamentos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhum pagamento encontrado.</Text>
        </View>
      ) : (
        pagamentos.map((item) => (
          <View key={item.id_rh} style={styles.card}>

            <View style={styles.cardLeft}>
              <Text style={styles.mes}>{item.mes_referencia}</Text>

              {item.horas_extras > 0 && (
                <Text style={styles.detalhe}>
                  +{item.horas_extras}h extras
                </Text>
              )}
              {item.descontos > 0 && (
                <Text style={styles.detalheDesconto}>
                  -{formatarValor(item.descontos)} descontos
                </Text>
              )}
              {item.bonus > 0 && (
                <Text style={styles.detalheBonus}>
                  +{formatarValor(item.bonus)} bônus
                </Text>
              )}
            </View>

            <View style={styles.cardRight}>
              <Text style={styles.valor}>
                {formatarValor(item.salario_final)}
              </Text>
              <View style={[
                styles.badge,
                item.status_pagamento === "pago"
                  ? styles.badgePago
                  : styles.badgePendente
              ]}>
                <Text style={styles.badgeText}>
                  {item.status_pagamento === "pago" ? "Pago" : "Pendente"}
                </Text>
              </View>
            </View>

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
  backButton: { width: 45, height: 45, backgroundColor: "#efefef", borderRadius: 50, justifyContent: "center", alignItems: "center" },
  backText: { fontSize: 26, fontWeight: "bold" },
  subtitle: { fontSize: 14, color: "#555" },
  card: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 15, padding: 20 },
  cardLeft: { flex: 1, gap: 3 },
  cardRight: { alignItems: "flex-end", gap: 6 },
  mes: { fontWeight: "bold", fontSize: 18 },
  detalhe: { color: "#888", fontSize: 12 },
  detalheDesconto: { color: "#e53935", fontSize: 12 },
  detalheBonus: { color: "#43a047", fontSize: 12 },
  valor: { fontSize: 16, fontWeight: "bold" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgePago: { backgroundColor: "#d4edda" },
  badgePendente: { backgroundColor: "#fff3cd" },
  badgeText: { fontSize: 11, fontWeight: "600" },
});