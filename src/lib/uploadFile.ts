import { supabase } from './supabaseClient';

export const uploadFile = async (bucket: string, file: File, userId: string): Promise<string> => {
  // Sanitize filename: remove spaces, special characters except dots and hyphens
  const sanitizedFileName = file.name
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  
  const filePath = `${userId}/${Date.now()}_${sanitizedFileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
  
  if (uploadError) {
    console.error('Upload failed:', uploadError);
    throw uploadError;
  }

  const { data, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (urlError || !data) {
    console.error('Signed URL creation failed:', urlError);
    throw urlError;
  }
  
  return data.signedUrl;
}; 