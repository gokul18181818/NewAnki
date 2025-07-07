import { supabase } from './supabaseClient';

export const uploadFile = async (bucket: string, file: File, userId: string): Promise<string> => {
  const filePath = `${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 60 * 60); // 1 hour

  if (urlError || !data) throw urlError;
  return data.signedUrl;
}; 