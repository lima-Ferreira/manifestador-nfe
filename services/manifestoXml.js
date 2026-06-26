export function gerarXmlManifesto({
  chaveNfe,
  cnpj,
  tpEvento,
  descEvento,
  dhEvento,
}) {
  const idLote = String(1).padStart(15, "0");
  const idEvento = `ID${tpEvento}${chaveNfe}01`;

  const xml =
    `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
    `<idLote>${idLote}</idLote>` +
    `<evento versao="1.00">` +
    `<infEvento Id="${idEvento}">` +
    `<cOrgao>91</cOrgao>` +
    `<tpAmb>2</tpAmb>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${chaveNfe}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento>` +
    `<tpEvento>${tpEvento}</tpEvento>` +
    `<nSeqEvento>1</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00">` +
    `<descEvento>${descEvento}</descEvento>` +
    `</detEvento>` +
    `</infEvento>` +
    `</evento>` +
    `</envEvento>`;

  return {
    idEvento,
    idLote,
    xml,
  };
}
