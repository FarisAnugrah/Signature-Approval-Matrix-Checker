export async function zipRequest(url: string, stage: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`${stage}: tidak dapat terhubung ke ${new URL(url).origin}. Pastikan backend aktif pada port 8001 di komputer browser; periksa koneksi, log backend, dan Network/Console browser untuk CORS atau pemblokiran koneksi. Jika sedang mengambil hasil, proses server mungkin masih berjalan.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : response.status === 413
      ? "Permintaan terlalu besar; periksa batas upload server/proxy."
      : "Periksa log backend/proxy dan respons di Network browser.";
    throw new Error(`${stage}: HTTP ${response.status}. ${detail}`);
  }
  if (!data || typeof data !== "object") throw new Error(`${stage}: respons backend bukan JSON yang valid.`);
  return data;
}
