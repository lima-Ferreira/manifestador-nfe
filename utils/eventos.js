export function normalizarCodigoEvento(evento) {
  const mapa = {
    ciencia: "210210",
    confirmacao: "210200",
    desconhecimento: "210220",
    nao_realizada: "210240",
    210210: "210210",
    210200: "210200",
    210220: "210220",
    210240: "210240",
  };

  return mapa[evento] || "";
}

export function obterDescricaoEvento(tpEvento) {
  const mapa = {
    210200: "Confirmacao da Operacao",
    210210: "Ciencia da Operacao",
    210220: "Desconhecimento da Operacao",
    210240: "Operacao nao Realizada",
  };

  return mapa[tpEvento] || "";
}
