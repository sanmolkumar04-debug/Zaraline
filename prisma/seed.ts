import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const COLORS: Record<string, [string, string, string, string]> = {
  RED: ["b3232f", "7a1420", "e0a13a", "d8b04a"],
  GREEN: ["1f6b4a", "a0283c", "e3b341", "c9a227"],
  WINE: ["6d2248", "3d1530", "e2c4d4", "c45a8b"],
  YELLOW: ["e3b12f", "b8373d", "2f5d8a", "b8373d"],
  PURPLE: ["5b2a86", "c43d6c", "1e7f7a", "d9a441"],
  PINK: ["d6337a", "5a1d3c", "f2c14e", "f29bbd"],
  WHITE: ["f3ede2", "8b2240", "8b2240", "c45a8b"],
  BLUE: ["23407a", "b3232f", "e0a13a", "3fa7c9"],
  MAROON: ["6e1423", "2d0b12", "d9a441", "b0303f"],
  MUSTARD: ["d19a1e", "1f3d7a", "1f6b4a", "7a2a1f"],
  BLACK: ["1c1c1c", "b3232f", "d9a441", "c9a227"],
  MULTI: ["6d2248", "c43d6c", "1e7f7a", "23407a"],
};

const PATTERNS = ["patola", "floral", "stripes", "plain"];

const LEHENGAS = [
  ["Dola Silk Patola Print Traditional Lehenga Choli", "WINE", "patola", 1599, 2899],
  ["Tussar Silk Foil Print Lehenga Choli", "MAROON", "floral", 1299, 4599],
  ["Floral Lehenga Choli With Foil Print & Gotta Patti Dupatta", "PINK", "floral", 1299, 4599],
  ["Dola Silk Patola Print Traditional Lehenga Choli", "PINK", "patola", 1599, 2899],
  ["Multi-Color Georgette Lehenga With Gota Patti Border", "MULTI", "stripes", 1799, 4499],
  ["Dola Silk Designer Kalamkari Print Lehenga Choli", "MUSTARD", "floral", 1599, 2899],
  ["Tussar Silk Foil Print Lehenga Choli", "RED", "floral", 1299, 4599],
  ["Tussar Silk Foil Print Lehenga Choli", "GREEN", "floral", 1299, 4599],
  ["Dola Silk Patola Print Traditional Lehenga Choli", "BLUE", "patola", 1599, 2899],
  ["Tussar Silk Patola Print Trendy Lehenga Choli", "WHITE", "patola", 1499, 3999],
  ["Tussar Silk Patola Print Trendy Lehenga Choli", "BLACK", "patola", 1499, 3999],
  ["Rayon Lehenga With Gamthi Work Blouse", "YELLOW", "stripes", 1399, 3299],
  ["Navratri Special Patola Print Lehenga Choli", "RED", "patola", 1699, 3999],
  ["Floral Woven Flared Lehenga & Choli With Dupatta", "YELLOW", "floral", 1899, 4299],
  ["Pure Roman Cotton Lehenga With Foil Work", "GREEN", "plain", 1699, 3999],
  ["Jacquard Silk Kalamkari Lehenga With Zari Weaving Border", "PURPLE", "floral", 1599, 2899],
  ["Chinon Silk Sequence Work Lehenga Choli", "WINE", "plain", 2199, 5499],
  ["Georgette Embroidered Bridesmaid Lehenga", "PINK", "plain", 2499, 6499],
  ["Cotton Printed Navratri Chaniya Choli", "MULTI", "stripes", 999, 2499],
  ["Art Silk Bandhani Print Lehenga Choli", "RED", "patola", 1199, 2999],
  ["Velvet Embroidered Lehenga Choli", "MAROON", "plain", 2799, 6999],
  ["Organza Floral Print Lehenga Choli", "WHITE", "floral", 1899, 4499],
  ["Georgette Mirror Work Lehenga Choli", "BLUE", "stripes", 1999, 4999],
  ["Silk Blend Leheriya Lehenga Choli", "GREEN", "stripes", 1099, 2699],
];

const SAREES = [
  ["Kanjivaram Soft Silk Saree With Zari Border", "MAROON", "plain", 1299, 3499],
  ["Banarasi Silk Woven Saree", "RED", "patola", 1499, 3999],
  ["Georgette Printed Saree With Blouse Piece", "PINK", "floral", 799, 1999],
  ["Chiffon Sequence Party Wear Saree", "BLACK", "plain", 1199, 2999],
  ["Cotton Linen Handloom Saree", "YELLOW", "stripes", 699, 1799],
  ["Patola Print Dola Silk Saree", "GREEN", "patola", 999, 2499],
  ["Organza Embroidered Saree", "WHITE", "floral", 1399, 3299],
  ["Tussar Silk Kalamkari Saree", "MUSTARD", "floral", 1099, 2799],
];

function shortId(n: number, len: number) {
  const a = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "", x = n * 2654435761 + 97;
  for (let i = 0; i < len; i++) { s += a[x % a.length]; x = Math.floor(x / a.length) + i * 7919 + n; }
  return s;
}

const slugify = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
const titleColor = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();

function specsFor(type: string, fabric: string, size: string) {
  const base: [string, string][] = [
    ["Fabric", fabric],
    ["Package Contents", type === "Saree" ? "SAREE AND BLOUSE PIECE" : "LEHENGA, BLOUSE AND DUPATTA"],
    ["Wash Care", "ONLY DRY CLEAN"],
    ["Product Weight", type === "Saree" ? "700 GM" : "1 KG"],
    ["Size", size],
    ["Country", "INDIA"],
    ["Brand", "Zari Lane"],
  ];
  if (type === "Saree") return [...base, ["Saree Length", "5.5 Mtr"], ["Blouse Length", "0.8 Mtr"]] as [string, string][];
  return [...base, ["Blouse", "Semi Stitched"], ["Blouse Length", "15"], ["Lehenga Length", "UP TO 42"], ["Lehenga Flair", "6 Mtr"], ["Dupatta Length", "2.3 Mtr"]] as [string, string][];
}

async function main() {
  await db.$transaction([
    db.orderEvent.deleteMany(), db.payment.deleteMany(), db.orderItem.deleteMany(), db.order.deleteMany(),
    db.cartItem.deleteMany(), db.cart.deleteMany(), db.productCollection.deleteMany(), db.variant.deleteMany(),
    db.product.deleteMany(), db.collection.deleteMany(), db.coupon.deleteMany(), db.shippingMethod.deleteMany(), db.review.deleteMany(),
  ]);

  const collections = [
    { id: "lhgChl01", name: "LEHENGA CHOLI", inNav: true, sort: 1 },
    { id: "tpSell02", name: "TOP SELLER", inNav: true, sort: 2 },
    { id: "frCol003", name: "FRESH COLLECTION", inNav: true, sort: 3 },
    { id: "nwArr004", name: "NEW ARRIVAL", inNav: false, sort: 4 },
    { id: "spLit005", name: "IN THE SPOTLIGHT", inNav: false, sort: 5 },
    { id: "saree006", name: "SAREE", inNav: false, sort: 6 },
    { id: "bstSl007", name: "BEST SELLERS", inNav: false, sort: 7 },
  ];
  for (const c of collections)
    await db.collection.create({ data: { ...c, slug: slugify(c.name), image: `/img/p/${COLORS.WHITE.join("-")}-floral/0.svg` } });

  const all = [
    ...LEHENGAS.map((r) => ({ r, type: "Lehenga Choli" })),
    ...SAREES.map((r) => ({ r, type: "Saree" })),
  ];

  let i = 0;
  for (const { r, type } of all) {
    i++;
    const [base, color, pattern, price, mrp] = r as [string, string, string, number, number];
    const name = `${titleColor(color)} ${base}`.replace("Multi ", "Multi-Color ").replace(/^(Multi-Color|White|Black) (Multi-Color)/, "$1");
    const id = shortId(i, 12);
    const spec = [...COLORS[color], pattern].join("-");
    const images = [0, 1, 2, 3, 4].map((v) => `/img/p/${spec}/${v}.svg`);
    const fabric = base.split(" ").slice(0, 2).join(" ").replace(/^(Women|Navratri|Pure)/, "Silk");
    // Every 4th lehenga gets real sizes to exercise variant selection; the rest are FREE SIZE like the reference.
    const sized = type === "Lehenga Choli" && i % 4 === 0;
    const sizes = sized ? ["S", "M", "L", "XL"] : ["FREE SIZE"];
    await db.product.create({
      data: {
        id, slug: slugify(name), name, productType: type, color,
        description:
          `✨ ${name} ✨\n\nCrafted in premium ${fabric.toLowerCase()} with intricate detailing, this piece is made for festive nights, sangeet and every celebration in between.\n\n` +
          `• ${type === "Saree" ? "Saree with unstitched blouse piece" : "Stitched lehenga with can-can & semi-stitched blouse"}\n• Rich zari / gota border finish\n• Comfortable all-night wear\n\n` +
          `Note: Slight colour variation is possible due to photography lighting.`,
        specs: JSON.stringify(specsFor(type, fabric.toUpperCase(), sizes.join(", "))),
        images: JSON.stringify(images),
        popularity: 1000 - ((i * 37) % 1000),
        createdAt: new Date(Date.now() - i * 86400000),
        variants: {
          create: sizes.map((size, k) => ({
            id: shortId(i * 10 + k, 8),
            size,
            price: price + (sized ? k * 100 : 0),
            mrp: mrp + (sized ? k * 100 : 0),
            // One sold-out size and one fully sold-out product to exercise out-of-stock paths.
            stock: (sized && size === "XL") || i === 11 ? 0 : 25,
          })),
        },
      },
    });

    const inCols = [type === "Saree" ? "saree006" : "lhgChl01"];
    if (i % 3 === 0) inCols.push("tpSell02");
    if (i <= 12) inCols.push("frCol003");
    if (i <= 8 || i > 28) inCols.push("nwArr004");
    if ([5, 9, 13, 17].includes(i)) inCols.push("spLit005");
    if (i % 2 === 1) inCols.push("bstSl007");
    for (const cid of inCols) await db.productCollection.create({ data: { productId: id, collectionId: cid, position: i } });
  }

  await db.coupon.createMany({
    data: [
      { code: "SALE10", title: "BUY 2 GET 10% OFF", description: "BUY 2 GET 10% OFF UPTO ₹200 ON PURCHASE OF ₹2449! Use coupon code: SALE10", kind: "PERCENT", value: 10, maxDiscount: 200, minAmount: 2449, minQty: 2 },
      { code: "SALE20", title: "BUY 3 GET 20% OFF", description: "BUY 3 GET 20% OFF UPTO ₹250 ON PURCHASE OF ₹3699! Use coupon code: SALE20", kind: "PERCENT", value: 20, maxDiscount: 250, minAmount: 3699, minQty: 3 },
    ],
  });

  await db.shippingMethod.createMany({
    data: [
      { id: "standard", name: "Standard Delivery", eta: "Get it delivered in 3-7 days", price: 0, sort: 0 },
    ],
  });

  const reviews = [
    ["Meera", "Absolutely loved the lehenga! The flair is huge and the colours are even prettier in person. Wore it for garba night and got so many compliments. Packaging was neat and delivery was quick."],
    ["Anjali", "The fabric is soft and comfortable, fits perfectly. The dupatta border is gorgeous. Will definitely order again for the wedding season."],
    ["Riya", "Stunning design, perfect fit and amazing quality. Received lots of compliments. Highly recommend!"],
    ["Pooja", "I bought this for my cousin's sangeet and I couldn't be happier with my decision. The outfit is absolutely stunning, the work is detailed and the colour is exactly as shown."],
    ["Sneha", "Very soft cotton silk, very comfortable to carry for the whole night."],
    ["Kavya", "Quality is exceptional, design is beautiful and the fit is perfect. Customer support helped me with sizing on WhatsApp too. Five stars!"],
    ["Nisha", "Great value for money. The foil print shines beautifully under lights."],
    ["Aditi", "The craftsmanship is top-notch and the fit is perfect. I felt like a princess wearing it to my friend's wedding. Everyone asked where I bought it from!"],
  ];
  const palettes = Object.keys(COLORS);
  for (const [k, [name, text]] of reviews.entries())
    await db.review.create({
      data: {
        name, text, rating: 5,
        image: `/img/p/${[...COLORS[palettes[(k * 3) % palettes.length]], PATTERNS[k % 4]].join("-")}/0.svg`,
        createdAt: new Date(Date.now() - (k + 1) * 6 * 86400000),
      },
    });

  console.log(`Seeded ${all.length} products, ${collections.length} collections, ${reviews.length} reviews`);
}

main().finally(() => db.$disconnect());
