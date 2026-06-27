import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | 레시피북",
  description: "레시피북 앱의 개인정보 처리방침",
};

const UPDATED = "2026년 6월 27일";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "#fff7ed" }}>
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-md p-7 md:p-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">개인정보 처리방침</h1>
        <p className="text-sm text-gray-400 mb-8">최종 업데이트: {UPDATED}</p>

        <div className="space-y-7 text-sm leading-relaxed text-gray-700">
          <section>
            <p>
              레시피북(이하 &ldquo;서비스&rdquo;)은 이용자의 개인정보를 중요하게 생각하며,
              관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집·이용하는지 설명합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">1. 수집하는 정보</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>이용자 입력 정보</b>: 레시피 추천을 위해 입력한 보유 재료, 인분 수,
                선호 옵션 등.
              </li>
              <li>
                <b>이미지</b>: 이용자가 직접 업로드한 완성 요리 사진(앱 내 사진 선택 시).
              </li>
              <li>
                <b>자동 수집 정보</b>: 서비스 이용 과정에서 생성되는 일반적인 접속 로그
                (오류 진단·서비스 개선 목적).
              </li>
            </ul>
            <p className="mt-2 text-gray-500">
              서비스는 회원가입을 요구하지 않으며, 이름·연락처 등 직접적인 신원 정보를
              수집하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">2. 정보의 이용 목적</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>입력한 재료 기반 AI 레시피 추천 및 조리 안내 제공</li>
              <li>레시피 이미지·음성 안내 생성</li>
              <li>업로드한 사진을 활용한 콘텐츠(게시물·영상) 생성</li>
              <li>서비스 품질 개선 및 오류 진단</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">3. 제3자 서비스 제공</h2>
            <p className="mb-2">
              서비스 제공을 위해 아래 외부 서비스에 일부 정보가 전송될 수 있습니다.
              각 서비스는 자체 개인정보 처리방침을 따릅니다.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><b>Anthropic (Claude)</b> — AI 레시피 생성</li>
              <li><b>Google (Gemini)</b> — 텍스트·이미지 생성 처리</li>
              <li><b>Typecast</b> — 음성(TTS) 생성</li>
              <li><b>Naver 쇼핑</b> — 재료 상품 검색</li>
              <li><b>Supabase</b> — 데이터·이미지 저장</li>
              <li><b>Vercel</b> — 서비스 호스팅</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">4. 기기 권한</h2>
            <p>
              완성 요리 사진 업로드 시 <b>사진 보관함 / 카메라</b> 접근 권한을 요청할 수
              있습니다. 이 권한은 이용자가 직접 선택한 사진을 업로드하는 용도로만
              사용되며, 동의 없이 다른 사진에 접근하지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">5. 보관 및 파기</h2>
            <p>
              입력 정보는 레시피 추천 처리에 필요한 기간 동안만 이용되며, 목적 달성 후
              관련 법령에 따라 파기됩니다. 업로드한 이미지는 콘텐츠 생성 목적 외에는
              사용되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">6. 이용자의 권리</h2>
            <p>
              이용자는 자신의 정보에 대한 열람·삭제를 요청할 수 있습니다. 아래 연락처로
              문의해 주세요.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-2">7. 문의처</h2>
            <p>
              개인정보 관련 문의: <b>showong0505@gmail.com</b>
            </p>
          </section>

          <section className="pt-2 border-t border-gray-100">
            <p className="text-gray-400 text-xs">
              본 방침은 관련 법령 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 본
              페이지를 통해 공지합니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
