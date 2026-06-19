import fs from "fs";
import forge from "node-forge";

export function carregarCertificado(caminho, senha) {
  const pfxBuffer = fs.readFileSync(caminho);

  const p12Der = forge.util.createBuffer(pfxBuffer.toString("binary"));

  const p12Asn1 = forge.asn1.fromDer(p12Der);

  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, senha);

  const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
  })[forge.pki.oids.pkcs8ShroudedKeyBag];

  const certBags = p12.getBags({
    bagType: forge.pki.oids.certBag,
  })[forge.pki.oids.certBag];

  if (!keyBags?.length) {
    throw new Error("❌ Nenhuma chave privada encontrada");
  }

  if (!certBags?.length) {
    throw new Error("❌ Nenhum certificado encontrado");
  }

  const keyPem = forge.pki.privateKeyToPem(keyBags[0].key);
  const certPem = forge.pki.certificateToPem(certBags[0].cert);

  return { keyPem, certPem };
}
