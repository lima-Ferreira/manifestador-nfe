import crypto from "crypto";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export function assinarXml(xmlString, privateKeyPem, certPem) {
  if (!privateKeyPem) {
    throw new Error("Chave privada não recebida");
  }

  // 1. Faz o Parser do XML para podermos manipular os nós do DOM
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // 2. Encontra a tag infEvento (alvo da assinatura da SEFAZ)
  const infEvento = xmlDoc.getElementsByTagName("infEvento")[0];
  if (!infEvento) {
    throw new Error("Elemento <infEvento> não encontrado no XML.");
  }

  // 3. Pega o ID do evento para usar na referência (ex: Id="ID110111...")
  const idElemento = infEvento.getAttribute("Id") || "";
  const uriReferencia = idElemento ? `#${idElemento}` : "";

  // 4. Limpa as quebras de linha do certificado digital para a tag X509Certificate
  const certLimpo = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\r?\n/g, "")
    .trim();

  // 5. C14N - Canonicalização simplificada do nó infEvento para gerar o Digest correto
  const serializer = new XMLSerializer();
  const infEventoContido = serializer.serializeToString(infEvento);

  // 6. Gera o DigestValue usando SHA-1 baseado no conteúdo da tag infEvento
  const hash = crypto.createHash("sha1");
  hash.update(infEventoContido, "utf8");
  const digestValue = hash.digest("base64");

  // 7. Monta a estrutura da tag <SignedInfo> exatamente como a SEFAZ exige
  const signedInfoXml =
    `<SignedInfo xmlns="http://w3.org">` +
    `<CanonicalizationMethod Algorithm="http://w3.org"/>` +
    `<SignatureMethod Algorithm="http://w3.orgrsa-sha1"/>` +
    `<Reference URI="${uriReferencia}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://w3.orgenveloped-signature"/>` +
    `<Transform Algorithm="http://w3.org"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://w3.orgsha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  // 8. Gera o SignatureValue criptografando o bloco <SignedInfo> com a sua chave privada RSA-SHA1
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(signedInfoXml, "utf8");
  const signatureValue = signer.sign(privateKeyPem.trim(), "base64");

  // 9. Monta o bloco completo da assinatura estruturada (<Signature>)
  const signatureXmlString =
    `<Signature xmlns="http://w3.org">` +
    signedInfoXml +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo>` +
    `<X509Data>` +
    `<X509Certificate>${certLimpo}</X509Certificate>` +
    `</X509Data>` +
    `</KeyInfo>` +
    `</Signature>`;

  // 10. Injeta o bloco <Signature> dentro do nó pai do evento fiscal
  const signatureDoc = parser.parseFromString(signatureXmlString, "text/xml");
  const signatureNode = xmlDoc.importNode(signatureDoc.documentElement, true);

  // O evento padrão da SEFAZ exige que a assinatura fique dentro da tag raiz do evento
  xmlDoc.documentElement.appendChild(signatureNode);

  // Retorna o XML final totalmente assinado em formato String
  return; // ❌ ANTES ESTAVA ASSIM:
  // return serializer.serializeToString(xmlDoc);

  // 🌟 ALTERE PARA FICAR EXATAMENTE ASSIM:
  // Força a correção da string quebrada gerada pelo DOMParser antes de retornar
  const xmlFinalString = serializer.serializeToString(xmlDoc);
  return xmlFinalString.replace(
    /xmlns="http:\/\/w3\.org"/g,
    'xmlns="http://w3.org"',
  );
}
