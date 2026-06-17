import fs from "fs";
import xlsx from "xlsx";

function extractExcelData(excelPath) {
  if (!fs.existsSync(excelPath)) {
    throw new Error("Arquivo de planilha não encontrado!");
  }

  // 1. Força a leitura do arquivo tratando absolutamente TUDO como texto bruto (String)
  // Isso impede chaves com "e+43", preserva as datas e mantém os valores originais!
  const workbook = xlsx.readFile(excelPath, { codepage: 65001 });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  // O parâmetro raw: false força a biblioteca a trazer o texto formatado visual da célula
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

  const extractedData = [];

  rows.forEach((columns) => {
    if (!columns || columns.length === 0) return;

    // Transforma a linha em texto corrido para limpar aspas que o SIGA injeta
    const rowString = columns.join(",");
    if (rowString.includes("CNPJ destina") || rowString.includes("Chave NF-e")) return;

    // Remove as aspas sobressalentes de cada campo obtido
    const cleanCells = columns.map(cell => cell ? String(cell).replace(/^"|"$/g, "").trim() : "");

    // Mapeamento baseado nos índices que vimos no seu log do terminal:
    // [0]:CNPJ | [1]:Razão | [2]:UF | [3]:Nota | [4]:Data | [5]:Status | [6]:Valor | [7]:Chave
    const statusBruto = cleanCells[5] || ""; 
    
    let statusNormalizado = statusBruto;
    if (statusBruto.toLowerCase().includes("cancel") || statusBruto.toLowerCase().includes("inutil")) {
      statusNormalizado = "cancelado";
    }

    // Captura a chave limpando espaços extras
    let chaveOriginal = cleanCells[7] || "";
    chaveOriginal = chaveOriginal.replace(/\s/g, "");

    const noteData = {
      dataTempo: cleanCells[4] || "",   // Data de emissão real
      uf: cleanCells[2] || "",          // UF
      numDoc: cleanCells[3] || "",      // Número da nota
      chave: chaveOriginal,             // Chave NF-e (Agora com os 44 dígitos puros!)
      fornecedor: cleanCells[1] || "",   // Razão social
      autorizacao: statusNormalizado,  // Status preparado para ficar vermelho
      valorDoDoc: cleanCells[6] || "",   // Valor formatado original
    };

    // Adiciona na lista apenas se a chave tiver o tamanho correto de uma NF-e
    if (noteData.chave && noteData.chave.length >= 44) {
      extractedData.push(noteData);
    }
  });

  return extractedData;
}

export { extractExcelData };
