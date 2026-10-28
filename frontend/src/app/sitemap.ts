import type { MetadataRoute } from "next";
import { config } from "@/config";

// Add each page here as it is built.
const routes = ["", "/features"];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${config.siteUrl}${path || "/"}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
