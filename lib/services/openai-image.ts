const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

export interface OpenAIImageResult {
  imageUrl: string;
  provider: "openai";
  model: string;
}

export async function generateImageWithOpenAI(
  prompt: string,
  apiKey: string,
  options: {
    model?: string;
    size?: string;
    quality?: string;
  } = {},
): Promise<OpenAIImageResult> {
  const model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
  const size = options.size ?? process.env.OPENAI_IMAGE_SIZE ?? "1024x1024";
  const quality = options.quality ?? process.env.OPENAI_IMAGE_QUALITY ?? "low";

  const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      quality,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64: string | undefined = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI API가 이미지를 반환하지 않았습니다.");

  return {
    imageUrl: `data:image/png;base64,${b64}`,
    provider: "openai",
    model,
  };
}
