import express from "express";
import cors from "cors";
import { fileUpload } from "./files-uploads/file.js";
import { extractExcelData } from "./services/excelService.js";
import { extractPdfChavesAsync } from "./services/pdfServices.js";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
// Libera o acesso para o front local e para o front do GitHub Pages
app.use(cors({
  origin: "*", 
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

// Rota de upload e comparação
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

// Marca quais notas já foram recebidas
const notas = arrExcel.map(item => ({
  ...item,
  recebida: arrPdf.includes(item.chave)
}));

// Resumo para exibir no topo da tela
const resumo = {
  total: notas.length,
  recebidas: notas.filter(n => n.recebida).length,
  pendentes: notas.filter(n => !n.recebida).length
};

res.json({
  notas,
  resumo
});

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao processar arquivos." });
    }
  }
);


// Rota para download do Excel direto no navegador
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

      // Destacar canceladas
      if (item.autorizacao?.toLowerCase() === "cancelado") {
        row.eachCell((cell) => {
          cell.font = { color: { argb: "FFFF0000" } };
        });
      }
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="chaves_faltando.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erro ao gerar Excel:", err);
    res.status(500).json({ error: "Erro ao gerar Excel." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
