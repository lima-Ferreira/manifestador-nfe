import axios from "axios";
import https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

export async function enviarManifestoSefaz(xmlAssinado) {
  const url =
    "https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx";

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">

  <soap:Body>
    <nfeRecepcaoEventoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/RecepcaoEvento4">
      <nfeDadosMsg>
        ${xmlAssinado}
      </nfeDadosMsg>
    </nfeRecepcaoEventoNF>
  </soap:Body>

</soap:Envelope>`;

  try {
    const response = await axios.post(url, soapEnvelope, {
      httpsAgent: agent,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction:
          '"http://www.portalfiscal.inf.br/nfe/wsdl/RecepcaoEvento4/nfeRecepcaoEventoNF"',
      },
    });

    return response.data;
  } catch (error) {
    console.log("ERRO SEFAZ:");
    console.log(error.response?.data || error.message);
    throw error;
  }
}
