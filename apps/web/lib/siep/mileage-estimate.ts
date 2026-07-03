import { geminiGenerateContent } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

const DEFAULT_L_PER_100KM = 9;

export function calcDistanceKm(odometerStart: number, odometerEnd: number): number {
  const d = odometerEnd - odometerStart;
  return d > 0 ? Math.round(d * 10) / 10 : 0;
}

export function calcReimbursementUsd(
  distanceKm: number,
  fuelPriceUsdPerLiter: number,
  litersPer100Km = DEFAULT_L_PER_100KM,
): { fuelLiters: number; reimbursementUsd: number } {
  const fuelLiters = Math.round((distanceKm * litersPer100Km) / 100 * 100) / 100;
  const reimbursementUsd = Math.round(fuelLiters * fuelPriceUsdPerLiter * 100) / 100;
  return { fuelLiters, reimbursementUsd };
}

export async function estimateFuelPriceUsd(params: {
  city: string;
  country: string;
  distanceKm: number;
}): Promise<{ fuelPriceUsdPerLiter: number; notes: string }> {
  const prompt = `Estime o preço médio atual da gasolina/gasóleo para veículos em USD por litro em:
Cidade: ${params.city}
País: ${params.country}

Use dados de mercado recentes (2025-2026). Responda APENAS JSON:
{ "fuelPriceUsdPerLiter": number, "notes": "breve fonte ou raciocínio" }`;

  try {
    const { text } = await geminiGenerateContent({
      systemInstruction: prompt,
      userParts: [{ text: 'Estimar preço combustível USD/L' }],
      temperature: 0.1,
      responseMimeType: 'application/json',
    });
    const parsed = JSON.parse(extractFirstJsonObject(text) || text) as {
      fuelPriceUsdPerLiter?: number;
      notes?: string;
    };
    const price = Number(parsed.fuelPriceUsdPerLiter);
    if (price > 0 && price < 10) {
      return { fuelPriceUsdPerLiter: price, notes: parsed.notes || 'Estimativa IA' };
    }
  } catch {
    // fallback abaixo
  }

  const countryLower = params.country.toLowerCase();
  let fallback = 1.15;
  if (countryLower.includes('mozambique') || countryLower.includes('moçambique')) fallback = 1.35;
  if (countryLower.includes('angola')) fallback = 0.95;
  if (countryLower.includes('brazil') || countryLower.includes('brasil')) fallback = 1.05;

  return {
    fuelPriceUsdPerLiter: fallback,
    notes: `Estimativa padrão regional (${fallback} USD/L) — confirme com comprovativo.`,
  };
}
