import fs from 'fs';
import path from 'path';

const GDRIVE_JSON = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
const GDRIVE_CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const GDRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const GDRIVE_REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const GDRIVE_ROOT = process.env.GDRIVE_ROOT_FOLDER_NAME || 'SSUU CARTAS';
const HAS_GDRIVE_CREDS = Boolean(
  GDRIVE_JSON || (GDRIVE_CLIENT_ID && GDRIVE_CLIENT_SECRET && GDRIVE_REFRESH_TOKEN)
);

// En Vercel preferimos Drive para no depender del filesystem efimero de produccion.
const STORAGE_MODE = (
  process.env.STORAGE_MODE ||
  (process.env.VERCEL || HAS_GDRIVE_CREDS ? 'GDRIVE' : 'LOCAL')
).toUpperCase();

// Directorios para el modo LOCAL
const LOCAL_BASE_DIR = path.join(process.cwd(), 'public', 'firmas');
const LOCAL_DIR_ENTRADA = path.join(LOCAL_BASE_DIR, 'entrada');
const LOCAL_DIR_FIRMADOS = path.join(LOCAL_BASE_DIR, 'firmados');

// Inicializar directorios locales
function ensureLocalDirs() {
  if (!fs.existsSync(LOCAL_BASE_DIR)) fs.mkdirSync(LOCAL_BASE_DIR, { recursive: true });
  if (!fs.existsSync(LOCAL_DIR_ENTRADA)) fs.mkdirSync(LOCAL_DIR_ENTRADA, { recursive: true });
  if (!fs.existsSync(LOCAL_DIR_FIRMADOS)) fs.mkdirSync(LOCAL_DIR_FIRMADOS, { recursive: true });
}

function getLocalDir(folder: 'entrada' | 'firmados') {
  return folder === 'entrada' ? LOCAL_DIR_ENTRADA : LOCAL_DIR_FIRMADOS;
}

function getSafeLocalPath(folder: 'entrada' | 'firmados', fileIdOrFilename: string) {
  const baseDir = path.resolve(getLocalDir(folder));
  const filePath = path.resolve(baseDir, fileIdOrFilename);

  if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
    throw new Error('Nombre de archivo invalido.');
  }

  return filePath;
}

function sanitizeLocalFilename(filename: string) {
  const baseName = path.basename(filename).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
  return baseName || 'documento.pdf';
}

export interface StoredFile {
  fileId: string; // ID de Google Drive o nombre del archivo local
  path: string;   // Ruta URL o ruta de acceso al archivo
  url: string;    // URL pública para previsualizar (en local o enlace web de Drive)
}

// Configuración de Google Drive API
let driveClient: any = null;
let driveFolderMap: Record<string, string> = {}; // 'entrada' | 'firmados' -> Folder ID

async function getDriveClient() {
  if (driveClient) return driveClient;

  try {
    const { google } = await import('googleapis');

    if (GDRIVE_CLIENT_ID && GDRIVE_CLIENT_SECRET && GDRIVE_REFRESH_TOKEN) {
      const auth = new google.auth.OAuth2(GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET);
      auth.setCredentials({ refresh_token: GDRIVE_REFRESH_TOKEN });
      driveClient = google.drive({ version: 'v3', auth });
      return driveClient;
    }

    if (!GDRIVE_JSON) {
      console.warn("⚠️ STORAGE_MODE está configurado en GDRIVE pero no hay credenciales de Google Drive.");
      return null;
    }

    const credentials = JSON.parse(GDRIVE_JSON);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
  } catch (error) {
    console.error("❌ Error al inicializar el cliente de Google Drive o cargar googleapis:", error);
    return null;
  }
}

// Asegurar estructura de carpetas en Google Drive
async function ensureDriveStructure(drive: any) {
  try {
    // 1. Buscar o crear carpeta raíz
    let rootFolderId = '';
    const rootQuery = `name='${GDRIVE_ROOT}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const rootRes = await drive.files.list({ q: rootQuery, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true });
    const rootFolders = rootRes.data.files || [];

    if (rootFolders.length === 0) {
      const rootMeta = {
        name: GDRIVE_ROOT,
        mimeType: 'application/vnd.google-apps.folder',
      };
      const rootFolder = await drive.files.create({ requestBody: rootMeta, fields: 'id', supportsAllDrives: true });
      rootFolderId = rootFolder.data.id;
      console.log(`📁 Creada carpeta raíz en Google Drive: ${GDRIVE_ROOT} (ID: ${rootFolderId})`);
    } else {
      rootFolderId = rootFolders[0].id;
    }

    // 2. Buscar o crear subcarpetas
    const subfolders = {
      entrada: 'POR FIRMAR',
      firmados: 'FIRMADO',
    };

    for (const [key, name] of Object.entries(subfolders)) {
      const subQuery = `name='${name}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const subRes = await drive.files.list({ q: subQuery, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true });
      const foundFolders = subRes.data.files || [];

      if (foundFolders.length === 0) {
        const subMeta = {
          name,
          parents: [rootFolderId],
          mimeType: 'application/vnd.google-apps.folder',
        };
        const subFolder = await drive.files.create({ requestBody: subMeta, fields: 'id', supportsAllDrives: true });
        driveFolderMap[key] = subFolder.data.id;
        console.log(`📁 Creada subcarpeta en Google Drive: ${name} (ID: ${subFolder.data.id})`);
      } else {
        driveFolderMap[key] = foundFolders[0].id;
      }
    }
  } catch (error) {
    console.error("❌ Error al asegurar estructura de carpetas en Google Drive:", error);
    throw error;
  }
}

export class StorageService {
  // Asegura que el backend de almacenamiento esté listo
  static async init(): Promise<string> {
    ensureLocalDirs();
    if (STORAGE_MODE === 'GDRIVE') {
      const drive = await getDriveClient();
      if (drive) {
        await ensureDriveStructure(drive);
        return 'GDRIVE';
      }
      throw new Error('Google Drive no esta configurado. Define GDRIVE_SERVICE_ACCOUNT_JSON o GDRIVE_CLIENT_ID/GDRIVE_CLIENT_SECRET/GDRIVE_REFRESH_TOKEN.');
    }
    return 'LOCAL';
  }

  // Cargar un archivo al almacenamiento
  static async upload(folder: 'entrada' | 'firmados', filename: string, content: Buffer): Promise<StoredFile> {
    const currentMode = await this.init();

    if (currentMode === 'GDRIVE') {
      const drive = await getDriveClient();
      const parentId = driveFolderMap[folder];
      if (!parentId) throw new Error(`Carpeta de destino de Google Drive no configurada: ${folder}`);

      // Subir a Google Drive
      const fileMetadata = {
        name: filename,
        parents: [parentId],
      };
      
      const { Readable } = require('stream');
      const media = {
        mimeType: 'application/pdf',
        body: Readable.from(content),
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      return {
        fileId: file.data.id,
        path: `${folder}/${filename}`,
        url: `/api/firmas/ver?fileId=${encodeURIComponent(file.data.id)}&folder=${folder}`,
      };
    } else {
      // Modo LOCAL
      const safeFilename = `${Date.now()}-${sanitizeLocalFilename(filename)}`;
      const destPath = getSafeLocalPath(folder, safeFilename);

      fs.writeFileSync(destPath, content);

      return {
        fileId: safeFilename,
        path: `${folder}/${safeFilename}`,
        url: `/api/firmas/ver?fileId=${encodeURIComponent(safeFilename)}&folder=${folder}`,
      };
    }
  }

  // Descargar un archivo (obtener Buffer de bytes)
  static async download(folder: 'entrada' | 'firmados', fileIdOrFilename: string): Promise<Buffer> {
    const currentMode = await this.init();

    if (currentMode === 'GDRIVE') {
      const drive = await getDriveClient();
      const response = await drive.files.get(
        { fileId: fileIdOrFilename, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      );
      return Buffer.from(response.data);
    } else {
      // Modo LOCAL
      const filePath = getSafeLocalPath(folder, fileIdOrFilename);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo local no encontrado en la ruta: ${filePath}`);
      }

      return fs.readFileSync(filePath);
    }
  }

  // Eliminar un archivo del almacenamiento
  static async delete(folder: 'entrada' | 'firmados', fileIdOrFilename: string): Promise<boolean> {
    const currentMode = await this.init();

    if (currentMode === 'GDRIVE') {
      try {
        const drive = await getDriveClient();
        await drive.files.delete({ fileId: fileIdOrFilename, supportsAllDrives: true });
        return true;
      } catch (error) {
        console.error(`❌ Error al eliminar archivo de Google Drive (${fileIdOrFilename}):`, error);
        return false;
      }
    } else {
      // Modo LOCAL
      try {
        const filePath = getSafeLocalPath(folder, fileIdOrFilename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          return true;
        }
        return false;
      } catch (error) {
        console.error(`❌ Error al eliminar archivo local (${fileIdOrFilename}):`, error);
        return false;
      }
    }
  }
}
