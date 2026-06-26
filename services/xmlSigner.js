import crypto from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

function removerDeclaracaoXml(xml) {
  return xml.replace(/^<\?xml[^>]*\?>\s*/i, "").trim();
}

function normalizarXml(xml) {
  return xml.replace(/\r?\n/g, "").replace(/>\s+</g, "><").trim();
}

export function assinarXml(xml, keyPem, certPem) {
  if (!xml) throw new Error("XML não informado.");
  if (!keyPem) throw new Error("Chave privada não informada.");
  if (!certPem) throw new Error("Certificado não informado.");

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const xmlDoc = parser.parseFromString(normalizarXml(xml), "text/xml");

  const infEvento = xmlDoc.getElementsByTagName("infEvento")[0];

  if (!infEvento) throw new Error("Elemento <infEvento> não encontrado.");

  const id = infEvento.getAttribute("Id");

  if (!id) throw new Error("Id do infEvento não encontrado.");

  const evento = xmlDoc.getElementsByTagName("evento")[0];

  if (!evento) throw new Error("Elemento <evento> não encontrado.");

  // Remove assinatura anterior caso exista
  const signatures = evento.getElementsByTagName("Signature");

  if (signatures.length) {
    evento.removeChild(signatures[0]);
  }

  let infEventoXml = serializer.serializeToString(infEvento);

  infEventoXml = removerDeclaracaoXml(normalizarXml(infEventoXml));

  // Remove namespace herdado para cálculo correto do Digest
  infEventoXml = infEventoXml.replace(
    ' xmlns="http://www.portalfiscal.inf.br/nfe"',
    "",
  );

  const digestValue = crypto
    .createHash("sha1")
    .update(infEventoXml, "utf8")
    .digest("base64");

  const XMLDSIG = "http://www.w3.org/2000/09/xmldsig#";
  const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  const RSA = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  const ENV = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
  const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";

  const signedInfo =
    `<SignedInfo xmlns="${XMLDSIG}">` +
    `<CanonicalizationMethod Algorithm="${C14N}"/>` +
    `<SignatureMethod Algorithm="${RSA}"/>` +
    `<Reference URI="#${id}">` +
    `<Transforms>` +
    `<Transform Algorithm="${ENV}"/>` +
    `<Transform Algorithm="${C14N}"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="${SHA1}"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const signer = crypto.createSign("RSA-SHA1");

  signer.update(signedInfo, "utf8");
  signer.end();

  const signatureValue = signer.sign(keyPem, "base64");

  const certificado = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\r?\n/g, "")
    .trim();

  const signatureXml =
    `<Signature xmlns="${XMLDSIG}">` +
    signedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certificado}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  const signatureDoc = parser.parseFromString(signatureXml, "text/xml");

  evento.appendChild(xmlDoc.importNode(signatureDoc.documentElement, true));

  return normalizarXml(serializer.serializeToString(xmlDoc));
}
