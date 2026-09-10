export const API_URL = import.meta.env.VITE_API_URL || '';

export const safeJson = async (response: Response) => {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
};
