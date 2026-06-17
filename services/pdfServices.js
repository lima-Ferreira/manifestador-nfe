// pdfService.js
import fs from "fs";
import PDFParser from "pdf2json";

function extractPdfChaves(pdfPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(pdfPath)) {
      return reject("PDF não encontrado!");
    }

    const pdfParser = new PDFParser();
    let resultado = "";

    pdfParser.on("pdfParser_dataError", (err) => reject(err.parserError));
    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      pdfData.Pages.forEach((page) => {
        page.Texts.forEach((text) => {
          text.R.forEach((t) => {
            resultado += decodeURIComponent(t.T);
          });
        });
      });

      const chaves = resultado.match(/(?:\d[\s]*){44}/g) || [];

      const chavesLimpa = chaves.map((c) => c.replace(/\s/g, ""));
      resolve([...new Set(chavesLimpa)]);
    });

    pdfParser.loadPDF(pdfPath);
  });
}

export async function extractPdfChavesAsync(pdfPath) {
  try {
    const chaves = await extractPdfChaves(pdfPath);
    return chaves;
  } catch (err) {
    console.error("Erro ao ler PDF:", err);
    return [];
  }
}
