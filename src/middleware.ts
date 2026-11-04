import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAuthPath, isProtectedPath } from "@/lib/routing";

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (!user && isProtectedPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return redirectKeepingCookies(url, response);
  }

  if (user && isAuthPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }

  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
