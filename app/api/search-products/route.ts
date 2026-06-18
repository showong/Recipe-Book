import { NextRequest, NextResponse } from "next/server";

export interface NaverProduct {
  title: string;
  link: string;
  image: string;
  price: number;
  mallName: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ products: [] });
  }

  const preferredSeller = process.env.NAVER_PREFERRED_SELLER ?? "";

  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      },
    );

    if (!res.ok) {
      console.error("[search-products] Naver API error:", res.status, await res.text());
      return NextResponse.json({ products: [] });
    }

    const data = await res.json() as { items?: Record<string, string>[] };
    let items: Record<string, string>[] = data.items ?? [];

    // 특정 판매자가 설정된 경우 필터링, 없으면 전체 결과 사용
    if (preferredSeller) {
      const filtered = items.filter((item) =>
        item.mallName?.includes(preferredSeller),
      );
      if (filtered.length > 0) items = filtered;
    }

    const products: NaverProduct[] = items.slice(0, 3).map((item) => ({
      title: item.title.replace(/<[^>]*>/g, ""),
      link: item.link,
      image: item.image,
      price: parseInt(item.lprice ?? "0") || 0,
      mallName: item.mallName,
    }));

    return NextResponse.json({ products });
  } catch (err) {
    console.error("[search-products] error:", err);
    return NextResponse.json({ products: [] });
  }
}
