/**
 * LLM 응답에서 첫 번째 완전한 JSON 객체만 안전하게 추출해 파싱한다.
 *
 * 모델이 코드펜스(```json)로 감싸거나, 완전한 JSON 뒤에 설명/잡음을 덧붙이거나,
 * 같은 객체를 두 번 출력하는 경우에도 첫 번째 균형 잡힌 { ... } 만 골라 파싱한다.
 */
export function parseFirstJsonObject<T = unknown>(raw: string): T {
  const text = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = text.indexOf("{");
  if (start === -1) throw new Error("응답에서 JSON 객체를 찾을 수 없습니다.");

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return JSON.parse(text.slice(start, i + 1)) as T;
      }
    }
  }

  // 닫는 괄호를 못 찾음 = 응답이 잘렸을 가능성. 최선의 시도로 전체 파싱.
  return JSON.parse(text.slice(start)) as T;
}
