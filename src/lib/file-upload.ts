import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos aceitos em TODOS os uploads de documentos do sistema
export const ACCEPT_DOCUMENTOS =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,.heic,.heif,.tiff,.tif,.bmp,.webp,.svg";

// Tipos aceitos para comprovantes e imagens (IA precisa ler)
export const ACCEPT_COMPROVANTES =
  "image/*,.pdf,.heic,.heif,.tiff,.tif,.bmp,.webp";

// Tipos aceitos para planilhas/dados
export const ACCEPT_PLANILHAS = ".csv,.xls,.xlsx,.ods,.txt";

// Tipos aceitos para imagens de campanha WhatsApp
export const ACCEPT_IMAGENS = "image/png,image/jpeg,image/jpg,image/webp";

// Tamanho máximo padrão (10MB)
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  path: string;
  nome: string;
  tipo: string;
  tamanho: number;
}

/**
 * Upload genérico para qualquer bucket do Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  clinicaId: string,
  file: File,
  subpasta?: string
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const sanitizedName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const pasta = subpasta ? `${clinicaId}/${subpasta}` : clinicaId;
  const filePath = `${pasta}/${Date.now()}_${sanitizedName}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw new Error(`Erro no upload: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
    nome: file.name,
    tipo: file.type,
    tamanho: file.size,
  };
}

/**
 * Converte File para base64 (para enviar para IA)
 */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Upload múltiplo com progresso
 */
export async function uploadMultipleFiles(
  bucket: string,
  clinicaId: string,
  files: File[],
  subpasta?: string,
  onProgress?: (current: number, total: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i + 1, files.length);
    const result = await uploadFile(bucket, clinicaId, files[i], subpasta);
    results.push(result);
  }
  return results;
}
