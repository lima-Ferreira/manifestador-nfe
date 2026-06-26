import https from "https";
import fs from "fs";
import { SEFAZ } from "../config/sefaz.js";

const HOST = "nfe-homologacao.svrs.rs.gov.br";
const PATH = "/ws/recepcaoevento/recepcaoevento4.asmx";

const ambiente = SEFAZ.homologacao;

const SOAP_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento";

export async function enviarManifestoSefaz(xmlAssinado, config) {
  if (!xmlAssinado) {
    throw new Error("XML assinado não informado.");
  }

  if (!config?.pfxPath) {
    throw new Error("config.pfxPath não informado.");
  }

  if (!config?.passphrase) {
    throw new Error("config.passphrase não informado.");
  }

  const pfx = fs.readFileSync(config.pfxPath);

  const httpsAgent = new https.Agent({
    pfx,
    passphrase: config.passphrase,
    rejectUnauthorized: false,
  });

  const soapEnvelope =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg "xmlns="${ambiente.namespace}">` +
    xmlAssinado +
    `</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`;

  console.log("\n================ SOAP ENVIADO ================\n");
  console.log(soapEnvelope);
  console.log("\n==============================================\n");

  const requestOptions = {
    hostname: ambiente.host,
    port: 443,
    path: ambiente.path,
    method: "POST",
    agent: httpsAgent,
    headers: {
      Host: ambiente.host,

      "Content-Type": `application/soap+xml; charset=utf-8; action="${ambiente.soapAction}"`,

      "Content-Length": Buffer.byteLength(soapEnvelope, "utf8"),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(requestOptions, (res) => {
      let resposta = "";

      res.on("data", (chunk) => {
        resposta += chunk.toString();
      });

      res.on("end", () => {
        console.log("========================================");
        console.log("STATUS HTTP:", res.statusCode);
        console.log("========================================");

        console.log(resposta);

        resolve({
          statusCode: res.statusCode,
          data: resposta,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(soapEnvelope, "utf8");
    req.end();
  });
}
