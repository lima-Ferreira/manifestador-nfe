import express from "express";
import cors from "cors";
import { fileUpload } from "./files-uploads/file.js";
import { extractExcelData } from "./services/excelService.js";
import { extractPdfChavesAsync } from "./services/pdfServices.js";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";
import { carregarCertificado } from "./certificados/certificado.js";
import { assinarXml } from "./services/xmlSigner.js";
// INTEGRADO: Novo cliente de envio SEFAZ
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
const cert = carregarCertificado(
  "./certificados/cert_jo_de_lima.pfx",
  "123456",
);

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

// ===============================
// DOWNLOAD EXCEL
// ===============================
app.post("/api/download-excel", async (req, res) => {
  try {
    const { chavesFaltando } = req.body;

    if (!Array.isArray(chavesFaltando) || chavesFaltando.length === 0) {
      return res.status(400).json({ error: "Nenhuma chave fornecida." });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Chaves Faltando");

    worksheet.columns = [
      { header: "Data", key: "dataTempo", width: 15 },
      { header: "UF", key: "uf", width: 5 },
      { header: "Documento", key: "numDoc", width: 15 },
      { header: "Chave", key: "chave", width: 45 },
      { header: "Fornecedor", key: "fornecedor", width: 30 },
      { header: "Situação", key: "autorizacao", width: 15 },
      { header: "Valor", key: "valorDoDoc", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };

    chavesFaltando.forEach((item) => {
      const row = worksheet.addRow(item);

      if (item.autorizacao?.toLowerCase() === "cancelado") {
        row.eachCell((cell) => {
          cell.font = { color: { argb: "FFFF0000" } };
        });
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="chaves_faltando.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erro ao gerar Excel:", err);
    res.status(500).json({ error: "Erro ao gerar Excel." });
  }
});

// ===============================
// MANIFESTAÇÃO (INTEGRADA COM ASSINATURA E SEFAZ)
// ===============================
app.post("/api/manifestar", async (req, res) => {
  try {
    const { evento, chaves } = req.body;

    if (!evento) {
      return res
        .status(400)
        .json({ sucesso: false, erro: "Evento não informado." });
    }

    if (!Array.isArray(chaves) || chaves.length === 0) {
      return res
        .status(400)
        .json({ sucesso: false, erro: "Nenhuma chave selecionada." });
    }

    console.log(
      `🚀 PROCESSANDO MANIFESTAÇÃO: ${evento} para ${chaves.length} notas.`,
    );

    const resultados = [];

    // Processa uma chave por vez gerando o XML individual exigido pela SEFAZ
    for (const nota of chaves) {
      const chaveNfe = nota.chave;
      const cnpjEmpresa = nota.cnpj || "12345678000100"; // Fallback ou pegue do req.body se disponível
      const dataIso = new Date().toISOString().replace(/\.\d+Z$/, "-03:00"); // Data atual no fuso do Brasil

      // Gerador ID padrão SEFAZ: "ID" + tpEvento + chaveNfe + nSeqEvento (01)
      const idSign = `ID${evento}${chaveNfe}01`;

      // 1. Monta o XML bruto estrutural dinâmico da manifestação
      const xmlBruto =
        `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
        `<idLote>1</idLote>` +
        `<evento versao="1.00">` +
        `<infEvento Id="${idSign}">` +
        `<cOrgao>91</cOrgao>` + // 91 é o Ambiente Nacional
        `<tpAmb>2</tpAmb>` + // 2 = Homologação (Testes), mude para 1 para Produção
        `<CNPJ>${cnpjEmpresa}</CNPJ>` +
        `<chNFe>${chaveNfe}</chNFe>` +
        `<dhEvento>${dataIso}</dhEvento>` +
        `<tpEvento>${evento}</tpEvento>` + // Ex: 210210 (Ciência)
        `<nSeqEvento>1</nSeqEvento>` +
        `<detEvento versao="1.00">` +
        `<descEvento>${nota.descEvento || "Ciencia da Operacao"}</descEvento>` +
        `</detEvento>` +
        `</infEvento>` +
        `</evento>` +
        `</envEvento>`;

      // 2. Executa a Assinatura Criptográfica Nativa
      const xmlAssinado = assinarXml(xmlBruto, cert.keyPem, cert.certPem);

      // 3. Envia o lote assinado para o Web Service da SEFAZ via HTTP/SOAP
      const respostaSefazXml = await enviarManifestoSefaz(
        xmlAssinado,
        cert.keyPem,
        cert.certPem,
      );

      resultados.push({
        chave: chaveNfe,
        status: "Processado",
        retornoSefaz: respostaSefazXml,
      });
    }

    // 4. Retorna a lista de notas manifestadas com as respostas do governo
    res.json({
      sucesso: true,
      quantidade: chaves.length,
      resultados,
    });
  } catch (error) {
    console.error("❌ Erro na rota de manifestação:", error);
    res.status(500).json({
      sucesso: false,
      erro: error.message,
    });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
