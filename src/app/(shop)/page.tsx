import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { CategoryTiles, HeroCarousel, Reel, ReviewCarousel } from "@/components/Home";
import { ProductGrid } from "@/components/ProductCard";
import { collectionHref, getReviews, listProducts, productCards } from "@/lib/catalog";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function Section({ title, viewAll, children, className = "" }: { title?: string; viewAll?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`container-x py-8 md:py-10 ${className}`}>
      {title && <h2 className="section-title">{title}</h2>}
      {viewAll && <div className="mt-3 text-center"><Link href={viewAll} className="text-[14px] font-semibold underline underline-offset-2">VIEW ALL</Link></div>}
      <div className={title ? "mt-8" : ""}>{children}</div>
    </section>
  );
}

export default async function Home() {
  const cols = Object.fromEntries((await db.collection.findMany()).map((c) => [c.name, c]));
  const [spotlight, all, reviews, reel, lehenga, saree] = await Promise.all([
    productCards(cols["IN THE SPOTLIGHT"].id, 4),
    listProducts({ pageSize: 8 }),
    getReviews(12),
    listProducts({ sort: "newest", pageSize: 6 }),
    productCards(cols["LEHENGA CHOLI"].id, 2),
    productCards(cols["SAREE"].id, 2),
  ]);
  // Category imagery comes from the catalogue itself (real photos once imported); generated art is only a fallback.
  const pic = (list: typeof lehenga, n: number, fallback: string) => list[0]?.images[n] ?? list[0]?.images[0] ?? fallback;
  const reelImages = reel.items.map((p) => p.images[0]);
  const videoDir = path.join(process.cwd(), "public", "media", "videos");
  const videos = fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter((f) => /\.(mp4|webm)$/i.test(f)).map((f) => `/media/videos/${f}`) : [];
  const half = Math.ceil(videos.length / 2);
  const bannerDir = path.join(process.cwd(), "public", "media", "banners");
  const banners = fs.existsSync(bannerDir) ? fs.readdirSync(bannerDir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).sort().map((f) => `/media/banners/${f}`) : [];
  const bannerLinks = [cols["FRESH COLLECTION"], cols["LEHENGA CHOLI"], cols["NEW ARRIVAL"]].map(collectionHref);
  const slides = banners.length
    ? banners.map((image, i) => ({ image, href: bannerLinks[i % bannerLinks.length], alt: "Zari Lane collection" }))
    : [
        { image: "/img/banner/0.svg", href: bannerLinks[0], alt: "Festive Bloom – floral lehengas" },
        { image: "/img/banner/1.svg", href: bannerLinks[1], alt: "Upto 71% off – Navratri edit" },
        { image: "/img/banner/2.svg", href: bannerLinks[2], alt: "New collection" },
      ];

  return (
    <>
      <HeroCarousel slides={slides} />

      <Section title="CATEGORY">
        <CategoryTiles items={[
          { name: "LEHENGA CHOLI", href: collectionHref(cols["LEHENGA CHOLI"]), image: pic(lehenga, 0, "/img/p/f3ede2-8b2240-8b2240-c45a8b-stripes/0.svg") },
          { name: "SAREE", href: collectionHref(cols["SAREE"]), image: pic(saree, 0, "/img/p/6e1423-2d0b12-d9a441-b0303f-plain/0.svg") },
        ]} />
      </Section>

      <Section><Reel images={reelImages} videos={videos.slice(0, 1)} caption="Festive Lookbook" /></Section>

      <Section title="SHOP BY CATEGORIES">
        <div className="grid grid-cols-2 gap-4 md:mx-auto md:max-w-[800px]">
          {[["LEHENGA CHOLI", pic(lehenga.slice(1), 0, "/img/p/e3b12f-b8373d-2f5d8a-b8373d-floral/4.svg")], ["SAREE", pic(saree.slice(1), 0, "/img/p/23407a-b3232f-e0a13a-3fa7c9-patola/4.svg")]].map(([name, src]) => (
            <Link key={name} href={collectionHref(cols[name])} className="group block overflow-hidden">
              <img src={src} alt={name} className="aspect-square w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
              <p className="mt-2 text-center text-[14px] font-semibold">{name}</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="IN THE SPOTLIGHT" viewAll={collectionHref(cols["IN THE SPOTLIGHT"])}>
        <ProductGrid items={spotlight} />
      </Section>

      <Link href={collectionHref(cols["NEW ARRIVAL"])} className="container-x block py-6">
        <img src="/media/banners/1.webp" alt="New collection" className="mx-auto h-auto w-full max-w-[900px]" />
      </Link>

      <Section title="ALL PRODUCTS" viewAll="/search">
        <ProductGrid items={all.items} />
      </Section>

      <Section><Reel images={[...reelImages].reverse()} videos={videos.length > 1 ? videos.slice(half) : []} arrows /></Section>

      <Section title="CUSTOMERS FEEDBACK" viewAll="/reviews">
        <ReviewCarousel reviews={reviews} />
      </Section>
    </>
  );
}
