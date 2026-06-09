import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useFonts, Cinzel_400Regular } from "@expo-google-fonts/cinzel";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../services/api";

// ==============================
// TIPOS
// ==============================

type User = {
  id: number;
  nome: string;
  cargo?: string;
  token: string;
};

// As 4 batidas de ponto possíveis
type TipoBatida =
  | "entrada"
  | "saida_almoco"
  | "retorno_almoco"
  | "saida";

// Batidas já registradas no dia (vêm do backend)
type BatidasDia = {
  entrada?: string;
  saida_almoco?: string;
  retorno_almoco?: string;
  saida?: string;
};

// ==============================
// CONFIGURAÇÃO DAS BATIDAS
// ==============================

const BATIDAS: {
  tipo: TipoBatida;
  label: string;
  labelCurto: string;
}[] = [
  { tipo: "entrada",       label: "Entrada",           labelCurto: "Entrada" },
  { tipo: "saida_almoco",  label: "Saída Almoço",      labelCurto: "S. Almoço" },
  { tipo: "retorno_almoco",label: "Retorno Almoço",    labelCurto: "R. Almoço" },
  { tipo: "saida",         label: "Saída",             labelCurto: "Saída" },
];


// ==============================
// COMPONENTE PRINCIPAL
// ==============================

export default function RegistrarPonto() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Cinzel_400Regular });

  const [user, setUser] = useState<User | null>(null);
  const [endereco, setEndereco] = useState("Obtendo localização...");
  const [agora, setAgora] = useState(new Date());
  const [batidas, setBatidas] = useState<BatidasDia>({});
  const [registrando, setRegistrando] = useState(false);


  // ==============================
  // CARREGA USUÁRIO
  // ==============================

  useEffect(() => {
    const carregar = async () => {
      const data = await AsyncStorage.getItem("user");
      if (data) {
        const u = JSON.parse(data) as User;
        setUser(u);
        carregarBatidasDoDia(u);
      }
    };
    carregar();
  }, []);


  // ==============================
  // BUSCA BATIDAS JÁ FEITAS HOJE
  // ==============================
  // Rota esperada no Flask:
  // GET /ponto/hoje/:id_user
  // Retorno esperado:
  // {
  //   entrada: "08:03",          (ou null)
  //   saida_almoco: "12:01",     (ou null)
  //   retorno_almoco: null,
  //   saida: null
  // }

  const carregarBatidasDoDia = async (u: User) => {
    try {
      const response = await fetch(`${API_URL}/ponto/hoje/${u.id}`, {
        headers: { Authorization: `Bearer ${u.token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setBatidas(data);
      }
    } catch (error) {
      console.log("Erro ao carregar batidas:", error);
    }
  };


  // ==============================
  // LOCALIZAÇÃO
  // ==============================

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setEndereco("Localização não autorizada");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync(location.coords);

      if (address.length > 0) {
        const { street, city } = address[0];
        setEndereco(`${street || ""}, ${city || ""}`);
      }
    })();
  }, []);


  // ==============================
  // RELÓGIO
  // ==============================

  useEffect(() => {
    const interval = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);


  // ==============================
  // QUAL É A PRÓXIMA BATIDA?
  // ==============================

  const proximaBatida = (): TipoBatida | null => {
    if (!batidas.entrada)        return "entrada";
    if (!batidas.saida_almoco)   return "saida_almoco";
    if (!batidas.retorno_almoco) return "retorno_almoco";
    if (!batidas.saida)          return "saida";
    return null; // todas feitas
  };


  // ==============================
  // REGISTRAR PONTO
  // ==============================
  // Rota esperada no Flask:
  // POST /ponto
  // Headers: Authorization: Bearer <token>
  // Body: {
  //   id_user: number,
  //   tipo: "entrada" | "saida_almoco" | "retorno_almoco" | "saida",
  //   data: "2026-06-07",
  //   hora: "08:03:21",
  //   latitude: number,
  //   longitude: number
  // }
  // Retorno: { sucesso: true, hora_registrada: "08:03" }

  const registrarPonto = async () => {
    if (!user) return;

    const tipo = proximaBatida();

    if (!tipo) {
      Alert.alert("Ponto completo", "Você já registrou todas as batidas de hoje!");
      return;
    }

    setRegistrando(true);

    try {
      // Pega localização atual para registrar junto
      let latitude = 0;
      let longitude = 0;

      try {
        const loc = await Location.getCurrentPositionAsync({});
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      } catch (_) {
        // continua mesmo sem GPS
      }

      const response = await fetch(`${API_URL}/ponto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          id_user: user.id,
          tipo,
          data: agora.toISOString().split("T")[0],
          hora: agora.toLocaleTimeString(),
          latitude,
          longitude,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Atualiza batidas localmente
        setBatidas((prev) => ({
          ...prev,
          [tipo]: data.hora_registrada || agora.toLocaleTimeString(),
        }));

        const labels: Record<TipoBatida, string> = {
          entrada: "Entrada",
          saida_almoco: "Saída para o almoço",
          retorno_almoco: "Retorno do almoço",
          saida: "Saída",
        };

        Alert.alert("✓ Ponto registrado", `${labels[tipo]} registrada com sucesso!`);
      } else {
        Alert.alert("Erro", data.mensagem || "Erro ao registrar ponto.");
      }

    } catch (error) {
      console.log("ERRO PONTO:", error);
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setRegistrando(false);
    }
  };


  // ==============================
  // LOGOUT
  // ==============================

  const sair = async () => {
    await AsyncStorage.removeItem("user");
    router.replace("/");
  };


  if (!fontsLoaded) return null;

  const proxima = proximaBatida();

  return (
    <ScrollView contentContainerStyle={style.container}>

      {/* Logo */}
      <Text style={style.texter}>WAEKIUM</Text>

      <View style={style.divider} />

      {/* Saudação */}
      <Text style={style.text}>Olá, {user?.nome || "..."}!</Text>
      <Text style={style.textfunc}>{user?.cargo || "Motorista"}</Text>

      {/* ==============================
          RELÓGIO E LOCALIZAÇÃO
      ============================== */}
      <View style={style.infoBox}>
        <Text style={style.infoText}>{agora.toLocaleTimeString()}</Text>
        <Text style={style.infoDate}>{agora.toLocaleDateString()}</Text>
        <Text style={style.infoAdd}>{endereco}</Text>
      </View>

      {/* ==============================
          BOTÃO REGISTRAR PONTO
      ============================== */}
      <TouchableOpacity
        style={[style.pontoButton, !proxima && style.pontoButtonDone]}
        onPress={registrarPonto}
        disabled={registrando || !proxima}
      >
        <Text style={style.pontoButtonText}>
          {registrando
            ? "Registrando..."
            : proxima
            ? `Registrar: ${BATIDAS.find((b) => b.tipo === proxima)?.label}`
            : "✓ Todas as batidas feitas!"}
        </Text>
      </TouchableOpacity>


      {/* ==============================
          GRID DE NAVEGAÇÃO
      ============================== */}
      <View style={style.grid}>

        <TouchableOpacity
          style={style.card}
          onPress={() => router.push("/agenda")}
        >
          <Text style={style.cardText}>Agenda</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={style.card}
          onPress={() => router.push("/rota")}
        >
          <Text style={style.cardText}>Rota</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={style.card}
          onPress={() => router.push("/financeiro")}
        >
          <Text style={style.cardText}>Financeiro</Text>
        </TouchableOpacity>

      </View>

      {/* Sair */}
      <TouchableOpacity onPress={sair} style={style.sairButton}>
        <Text style={style.sairText}>Sair</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}


// ==============================
// ESTILOS
// ==============================

const style = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
    gap: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#ccc",
    width: "90%",
    alignSelf: "center",
  },
  dividera: {
    height: 1,
    backgroundColor: "#ccc",
    width: "90%",
    alignSelf: "center",
    marginTop: 10,
  },
  texter: {
    fontSize: 40,
    textAlign: "center",
    fontFamily: "Cinzel_400Regular",
  },
  text: {
    fontSize: 30,
    alignSelf: "flex-start",
    marginTop: 25,
  },
  textfunc: {
    fontSize: 20,
    alignSelf: "flex-start",
    color: "#555",
    marginTop: -10,
  },
  infoBox: {
    alignItems: "center",
    gap: 4,
    marginVertical: 10,
    marginTop: 50,
  },
  infoText: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#000",
  },
  infoDate: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  infoAdd: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
  pontoButton: {
    width: "60%",
    backgroundColor: "#000",
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: "center",
  },
  pontoButtonDone: {
    backgroundColor: "#4caf50",
  },
  pontoButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  // Timeline
  timeline: {
    width: "100%",
    gap: 0,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 60,
  },
  timelineLeft: {
    alignItems: "center",
    width: 24,
    marginRight: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ddd",
    borderWidth: 2,
    borderColor: "#ccc",
    marginTop: 4,
  },
  dotFeita: {
    backgroundColor: "#4caf50",
    borderColor: "#4caf50",
  },
  dotProxima: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: "#ddd",
    marginVertical: 4,
    minHeight: 36,
  },
  lineFeita: {
    backgroundColor: "#4caf50",
  },
  timelineInfo: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineLabel: {
    fontSize: 15,
    color: "#999",
    fontWeight: "500",
  },
  timelineLabelFeita: {
    color: "#000",
    fontWeight: "bold",
  },
  timelineHora: {
    fontSize: 13,
    color: "#aaa",
    marginTop: 2,
  },
  // Grid
  grid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 160,
  },
  card: {
    flex: 1,
    height: 100,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  cardText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  sairButton: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  sairText: {
    color: "#999",
    fontSize: 14,
  },
});