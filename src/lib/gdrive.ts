import fs from 'fs';
import path from 'path';

const GDRIVE_JSON = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
const GDRIVE_CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const GDRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const GDRIVE_REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const GDRIVE_ROOT_FOLDER_ID = process.env.GDRIVE_ROOT_FOLDER_ID;
const GDRIVE_ROOT = process.env.GDRIVE_ROOT_FOLDER_NAME || 'SSUU CARTAS';
const HAS_GDRIVE_CREDS = Boolean(
  GDRIVE_JSON || (GDRIVE_CLIENT_ID && GDRIVE_CLIENT_SECRET && GDRIVE_REFRESH_TOKEN)
);

type StorageMode = 'GDRIVE' | 'LOCAL';

// En Vercel Drive debe estar configurado explicitamente; el filesystem de produccion no es persistente.
const STORAGE_MODE = (
  process.env.STORAGE_MODE ||
  (HAS_GDRIVE_CREDS ? 'GDRIVE' : 'LOCAL')
).toUpperCase() as StorageMode;

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

function getMissingDriveEnvVars() {
  if (GDRIVE_JSON) return [];

  const missing = [];
  if (!GDRIVE_CLIENT_ID) missing.push('GDRIVE_CLIENT_ID');
  if (!GDRIVE_CLIENT_SECRET) missing.push('GDRIVE_CLIENT_SECRET');
  if (!GDRIVE_REFRESH_TOKEN) missing.push('GDRIVE_REFRESH_TOKEN');
  return missing;
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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

    const missing = getMissingDriveEnvVars();
    if (missing.length > 0) {
      console.warn(`⚠️ STORAGE_MODE=GDRIVE pero faltan variables de Google Drive: ${missing.join(', ')}`);
      return null;
    }

    const credentials = JSON.parse(GDRIVE_JSON as string);
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
    let rootFolderId = GDRIVE_ROOT_FOLDER_ID || '';
    if (!rootFolderId) {
    const safeRootName = escapeDriveQueryValue(GDRIVE_ROOT);
    const rootQuery = `name='${safeRootName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const rootRes = await drive.files.list({ q: rootQuery, fields: 'files(id, name)', supportsAllDrives: true, includeItemsFromAllDrives: true });
    const rootFolders = rootRes.data.files || [];

    if (rootFolders.length === 0) {
      if (GDRIVE_JSON) {
        throw new Error('Con GDRIVE_SERVICE_ACCOUNT_JSON debes usar una carpeta en una Unidad compartida y configurar GDRIVE_ROOT_FOLDER_ID.');
      }

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
    }

    // 2. Buscar o crear subcarpetas
    const subfolders = {
      entrada: 'POR FIRMAR',
      firmados: 'FIRMADO',
    };

    for (const [key, name] of Object.entries(subfolders)) {
      const safeName = escapeDriveQueryValue(name);
      const subQuery = `name='${safeName}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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
    if (STORAGE_MODE !== 'GDRIVE' && STORAGE_MODE !== 'LOCAL') {
      throw new Error(`STORAGE_MODE invalido: "${STORAGE_MODE}". Usa GDRIVE o LOCAL.`);
    }

    if (STORAGE_MODE === 'GDRIVE') {
      const missing = getMissingDriveEnvVars();
      if (missing.length > 0) {
        throw new Error(`Google Drive no esta configurado en el servidor. Faltan variables: ${missing.join(', ')}.`);
      }

      const drive = await getDriveClient();
      if (drive) {
        await ensureDriveStructure(drive);
        return 'GDRIVE';
      }
      throw new Error('No se pudo inicializar Google Drive. Revisa que las credenciales configuradas en Vercel sean validas.');
    }

    if (process.env.VERCEL) {
      throw new Error('STORAGE_MODE=LOCAL no es compatible con Vercel porque sus archivos no son persistentes. Configura STORAGE_MODE=GDRIVE y las credenciales de Google Drive.');
    }
    
    // Solo creamos directorios locales si estamos en modo LOCAL
    ensureLocalDirs();
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

  // Pre-crea un archivo vacío para obtener un File ID y URL pública estimada
  static async precrear(folder: 'entrada' | 'firmados', filename: string): Promise<{ fileId: string; url: string }> {
    const currentMode = await this.init();

    if (currentMode === 'GDRIVE') {
      const drive = await getDriveClient();
      const parentId = driveFolderMap[folder];
      if (!parentId) throw new Error(`Carpeta de destino de Google Drive no configurada: ${folder}`);

      // Crear archivo vacío en Drive (sin cuerpo)
      const fileMetadata = {
        name: filename,
        parents: [parentId],
      };
      
      const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      // Asegurar que la URL sea pública por defecto (estimando su formato final)
      const fileId = file.data.id;
      // Para cuentas personales, el enlace webViewLink o el enlace estándar directo funcionan bien.
      const shareUrl = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;

      return {
        fileId,
        url: shareUrl,
      };
    } else {
      // Modo LOCAL
      const safeFilename = `${Date.now()}-${sanitizeLocalFilename(filename)}`;
      
      // En modo local la URL definitiva que devuelve es la de visualizar del servidor
      const shareUrl = `/api/firmas/ver?fileId=${encodeURIComponent(safeFilename)}&folder=${folder}`;
      
      return {
        fileId: safeFilename,
        url: shareUrl,
      };
    }
  }

  // Actualiza el contenido de un archivo pre-creado y le asigna los permisos correspondientes
  static async update(folder: 'entrada' | 'firmados', fileId: string, filename: string, content: Buffer): Promise<StoredFile> {
    const currentMode = await this.init();

    if (currentMode === 'GDRIVE') {
      const drive = await getDriveClient();
      
      const { Readable } = require('stream');
      const media = {
        mimeType: 'application/pdf',
        body: Readable.from(content),
      };

      // Actualizar el archivo precreado con el PDF final firmado
      await drive.files.update({
        fileId: fileId,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
      });

      let shareUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;

      // Si es el archivo firmado final en Drive, le damos permisos públicos de lectura
      if (folder === 'firmados') {
        try {
          console.log(`🔓 Configurando permisos de lectura pública en Google Drive para el archivo ${fileId}...`);
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
          });
          
          // Obtener el webViewLink definitivo tras cambiar permisos
          const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'webViewLink',
            supportsAllDrives: true,
          });
          if (fileMetadata.data.webViewLink) {
            shareUrl = fileMetadata.data.webViewLink;
          }
        } catch (permError) {
          console.error("⚠️ No se pudo asignar permisos de lectura pública en Google Drive:", permError);
        }
      }

      return {
        fileId: fileId,
        path: `${folder}/${filename}`,
        url: shareUrl,
      };
    } else {
      // Modo LOCAL: Guardar en el archivo pre-reservado
      const destPath = getSafeLocalPath(folder, fileId);
      fs.writeFileSync(destPath, content);

      return {
        fileId: fileId,
        path: `${folder}/${fileId}`,
        url: `/api/firmas/ver?fileId=${encodeURIComponent(fileId)}&folder=${folder}`,
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
