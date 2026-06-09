import * as React from "react"; // importa tudo do React
const MOBILE_BREAKPOINT = 768; // largura máxima considerada mobile

export function useIsMobile() { // hook que detecta se é mobile
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined); // estado que guarda true/false

  React.useEffect(() => { // executa quando componente carregar
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`); // monitora tamanho da tela
    const onChange = () => { // função executada ao mudar tamanho
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); // verifica se largura é menor que 768
    };
    mql.addEventListener("change", onChange); // adiciona listener
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); // verifica tamanho inicial
    return () => mql.removeEventListener("change", onChange); // remove listener ao desmontar
  }, []);

  return !!isMobile; // retorna true ou false
}