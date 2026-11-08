import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { capture } from "./http/capture";

const http = httpRouter();

auth.addHttpRoutes(http);
http.route({ path: "/capture", method: "POST", handler: capture });

export default http;
