import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Star Press — Commercial & Custom Printing",
    short_name: "Star Press",
    description:
      "Turning Ideas Into Print — Premium business cards, marketing flyers, flex banners, custom stickers, packaging, and corporate merchandise across India.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0C10",
    theme_color: "#0B0C10",
    icons: [
      {
        src: "/images/Logo.png",
        sizes: "any",
        type: "image/png",
      },
      {
        src: "/images/Logo.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
