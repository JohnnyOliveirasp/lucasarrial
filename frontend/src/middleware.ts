import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    /*
     * Match all paths EXCEPT:
     * - /api, /_next, /_vercel
     * - paths with a dot (files like favicon.ico, robots.txt, images, video, etc.)
     */
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
