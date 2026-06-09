import { useSyncExternalStore } from "react"; // hooks do React
import { realtime } from "@/lib/realtime"; // sistema realtime e simulação

export function useRealtime() { // hook personalizado do realtime
  return useSyncExternalStore( // conecta React com store externa
    (cb) => { // função de inscrição
      const unsub = realtime.subscribe(cb); // escuta mudanças
      return () => { // cleanup
        unsub(); // cancela inscrição
      };
    },
    () => realtime.getState(), // pega estado atual no cliente
    () => realtime.getState(), // pega estado atual no servidor
  );
}
