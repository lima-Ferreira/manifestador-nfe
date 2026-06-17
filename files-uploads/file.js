import multer from "multer";
import path from "path";
import fs from "fs";

// Define diretório de upload
const uploadDir = "files-uploads/uploads";

// Cria o diretório se não existir
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const sanitized = nameWithoutExt.replace(/\s+/g, "_"); // remove espaços
    cb(null, `${sanitized}${ext}`);
  },
});

const fileUpload = multer({ storage });

export { fileUpload };
