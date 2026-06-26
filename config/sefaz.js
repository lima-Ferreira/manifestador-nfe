export const SEFAZ = {
  homologacao: {
    host: "nfe-homologacao.svrs.rs.gov.br",

    path: "/ws/recepcaoevento/recepcaoevento4.asmx",

    soapAction:
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",

    namespace: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4",

    tpAmb: "2",
  },

  producao: {
    host: "nfe.svrs.rs.gov.br",

    path: "/ws/recepcaoevento/recepcaoevento4.asmx",

    soapAction:
      "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento",

    namespace: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4",

    tpAmb: "1",
  },
};
