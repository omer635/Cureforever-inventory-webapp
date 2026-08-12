import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CureForever — Enterprise Inventory Platform",
    short_name: "CureForever",
    description: "CureForever enterprise inventory portal for vendors and administrators",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1F3D",
    theme_color: "#0F1F3D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
