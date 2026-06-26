import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { fileUpload } from "./files-uploads/file.js";
import { extractExcelData } from "./services/excelService.js";
import { extractPdfChavesAsync } from "./services/pdfServices.js";

import { carregarCertificado } from "./certificados/certificado.js";
import { assinarXml } from "./services/xmlSigner.js";
import { enviarManifestoSefaz } from "./services/sefazClient.js";

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  }),
);

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// ===============================
// CARREGAMENTO DO CERTIFICADO DIGITAL
// ===============================
const PFX_PATH = "./certificados/cert_jo_de_lima.pfx";
const PFX_PASS = "123456";

const cert = carregarCertificado(PFX_PATH, PFX_PASS);

console.log("🔒 CERTIFICADO CONFIGURADO COM SUCESSO");
console.log("KEY OK:", !!cert.keyPem);
console.log("CERT OK:", !!cert.certPem);

// ===============================
// UPLOAD EXCEL + PDF
// ===============================
app.post(
  "/api/upload",
  fileUpload.fields([
    { name: "excelFile", maxCount: 1 },
    { name: "pdfFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const excelFile = req.files?.["excelFile"]?.[0];
      const pdfFile = req.files?.["pdfFile"]?.[0];

      if (!excelFile || !pdfFile) {
        return res.status(400).json({ error: "Envie Excel e PDF." });
      }

      const arrExcel = extractExcelData(excelFile.path);
      const arrPdf = await extractPdfChavesAsync(pdfFile.path);

      const notas = arrExcel.map((item) => ({
        ...item,
        recebida: arrPdf.includes(item.chave),
      }));

      const resumo = {
        total: notas.length,
        recebidas: notas.filter((n) => n.recebida).length,
        pendentes: notas.filter((n) => !n.recebida).length,
      };

      res.json({ notas, resumo });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao processar arquivos." });
    }
  },
);
// ==========================================
// FUNÇÕES AUXILIARES DE SUPORTE AO MANIFESTO
// ==========================================
function normalizarCodigoEvento(evento) {
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

function obterDescricaoEvento(tpEvento) {
  const mapa = {
    210200: "Confirmacao da Operacao",
    210210: "Ciencia da Operacao",
    210220: "Desconhecimento da Operacao",
    210240: "Operacao nao Realizada",
  };
  return mapa[tpEvento] || "";
}

function gerarDhEvento() {
  const agora = new Date();
  const yyyy = agora.getFullYear();
  const mm = String(agora.getMonth() + 1).padStart(2, "0");
  const dd = String(agora.getDate()).padStart(2, "0");
  const hh = String(agora.getHours()).padStart(2, "0");
  const mi = String(agora.getMinutes()).padStart(2, "0");
  const ss = String(agora.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`;
}

// =======================================================
// MANIFESTAÇÃO (BLINDAGEM TOTAL DE DNS COM AXIOS NATIVO)
// =======================================================
// =======================================================
// MANIFESTAÇÃO (AJUSTE DOS ÍNDICES DO DOM E ENVIO AXIOS)
// =======================================================
// =======================================================
// MANIFESTAÇÃO (ASSINATURA TEXTUAL BLINDADA E ENVIO POR IP)
// =======================================================
app.post("/api/manifestar", async (req, res) => {
  try {
    console.log("========== /api/manifestar ==========");
    console.log("BODY RECEBIDO:", JSON.stringify(req.body, null, 2));

    const { evento, chaves } = req.body;

    if (!evento) {
      return res.status(400).json({
        sucesso: false,
        erro: "Evento não informado.",
      });
    }

    if (!Array.isArray(chaves) || chaves.length === 0) {
      return res.status(400).json({
        sucesso: false,
        erro: "Nenhuma chave selecionada.",
      });
    }

    const tpEvento = normalizarCodigoEvento(evento);
    if (!tpEvento) {
      return res.status(400).json({
        sucesso: false,
        erro: `Evento inválido: ${evento}`,
      });
    }

    const descEvento = obterDescricaoEvento(tpEvento);
    if (!descEvento) {
      return res.status(400).json({
        sucesso: false,
        erro: "Descrição do evento não encontrada.",
      });
    }

    const resultados = [];

    for (const nota of chaves) {
      console.log("----- NOTA RECEBIDA -----");

      const chaveNfe = typeof nota === "string" ? nota : nota?.chave;

      const cnpjEmpresa =
        typeof nota === "object" && nota?.cnpj
          ? nota.cnpj.replace(/\D/g, "")
          : "07870381000109";

      if (!chaveNfe) {
        resultados.push({
          chave: null,
          status: "Erro",
          retornoSefaz: "Chave da NFe não informada.",
        });
        continue;
      }

      try {
        console.log(`Step 1: Montando XML base da chave ${chaveNfe}...`);

        const idLote = String(1).padStart(15, "0");
        const dataIso = gerarDhEvento();
        const idSign = `ID${tpEvento}${chaveNfe}01`;

        const xmlBase =
          `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
          `<idLote>${idLote}</idLote>` +
          `<evento versao="1.00">` +
          `<infEvento Id="${idSign}">` +
          `<cOrgao>91</cOrgao>` +
          `<tpAmb>2</tpAmb>` +
          `<CNPJ>${cnpjEmpresa}</CNPJ>` +
          `<chNFe>${chaveNfe}</chNFe>` +
          `<dhEvento>${dataIso}</dhEvento>` +
          `<tpEvento>${tpEvento}</tpEvento>` +
          `<nSeqEvento>1</nSeqEvento>` +
          `<verEvento>1.00</verEvento>` +
          `<detEvento versao="1.00">` +
          `<descEvento>${descEvento}</descEvento>` +
          `</detEvento>` +
          `</infEvento>` +
          `</evento>` +
          `</envEvento>`;

        console.log("===== XML BASE =====");
        console.log(xmlBase);

        console.log("Step 2: Assinando XML...");
        const xmlAssinado = assinarXml(xmlBase, cert.keyPem, cert.certPem);

        console.log("===== XML ASSINADO =====");
        console.log(xmlAssinado);

        console.log("Step 3: Enviando XML assinado para a SEFAZ...");
        const respostaSefaz = await enviarManifestoSefaz(xmlAssinado, {
          pfxPath: PFX_PATH,
          passphrase: PFX_PASS,
        });

        resultados.push({
          chave: chaveNfe,
          status: respostaSefaz.statusCode === 200 ? "Processado" : "Erro",
          retornoSefaz: respostaSefaz.data,
          statusCode: respostaSefaz.statusCode,
        });
      } catch (errNota) {
        console.error(`❌ Erro ao processar a chave ${chaveNfe}:`, errNota);

        resultados.push({
          chave: chaveNfe,
          status: "Erro",
          retornoSefaz:
            errNota.message || "Erro interno ao processar manifestação.",
        });
      }
    }

    return res.json({
      sucesso: true,
      quantidade: chaves.length,
      resultados,
    });
  } catch (error) {
    console.error("❌ Erro geral no endpoint /api/manifestar:", error);

    return res.status(500).json({
      sucesso: false,
      erro: error.message || "Erro interno no servidor.",
    });
  }
});

// Inicialização estável da porta do servidor Express
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`Servidor rodando na porta http://localhost:${PORT}`),
);
