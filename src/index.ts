const VALID_PORTAL_IDS = [562] as const;

const OVERSIZED_IMAGE_URL =
  "https://raw.githubusercontent.com/yevheniia-rubtsova/product-xml-worker/refs/heads/main/test-assets/oversized-test-image.jpg";

const MAIN_IMAGE_URL = 
    "https://raw.githubusercontent.com/yevheniia-rubtsova/product-xml-worker/refs/heads/main/test-assets/main-test-image.jpg";

type PortalId = (typeof VALID_PORTAL_IDS)[number];

interface Product {
  id: number;
  available: boolean;

  nameUa: string;
  nameRu: string;

  descriptionUa: string;
  descriptionRu: string;

  price: number;
  oldPrice?: number;

  categoryId: number;
  categoryName: string;

  portalId: PortalId;

  vendor: string;
  country: string;

  temperatureMode: string;

  pictures: string[];

  params: {
    name: string;
    value: string;
  }[];
}


// ======================================================
// PRODUCT TEMPLATE
// ======================================================

const products: Product[] = [
  {
    id: 12345,
    available: true,

    nameUa:
      "Чипси Pringles Сметана та цибуля 330 г (2 п. x 165 г)",

    nameRu:
      "Чипсы Pringles Сметана и лук 330 г (2 п. x 165 г)",

    descriptionUa:
      "Чипси Pringles Sour Сметана та цибуля - це високоякісний продукт.",

    descriptionRu:
      "Чипсы Pringles Сметана и лук - это высококачественный продукт.",

    price: 122,
    oldPrice: 646,

    categoryId: 123,
    categoryName: "Чипси",

    portalId: 562,

    vendor: "Pringles",
    country: "Бельгія",

    temperatureMode: "cooling",

    pictures: [
      "https://placehold.co/600x600.jpg",
    ],

    params: [
      { name: "Тип", value: "Картопляні" },
      { name: "Вид", value: "Смажені" },
      { name: "Смак", value: "Сметана" },
      { name: "Вага", value: "100 г" },
      { name: "Вага", value: "50 г - 150 г" },
      { name: "Форма", value: "Пласт" },
      { name: "Упаковка", value: "Тубус" },
      {
        name: "Особливості",
        value: "Без пальмової олії",
      },
      { name: "Тип", value: "Чипси" },
    ],
  },
];


// ======================================================
// RANDOM IMAGE GENERATION
// ======================================================

function generatePicturesForProduct(): string[] {
  const imageCount = Math.floor(Math.random() * 12) + 1;

  const pictures = [MAIN_IMAGE_URL];

  for (let index = 1; index < imageCount; index++) {
    pictures.push(
      `https://placehold.co/600x600.jpg?text=product-${index + 1}`
    );
  }

  return pictures;
}


// ======================================================
// RANDOM PRODUCT GENERATION
// ======================================================

function generateProducts(
  count: number,
  oversizedImage: boolean
): Product[] {
  const template = products[0];

  const randomBase =
    1_000_000_000 +
    (crypto.getRandomValues(new Uint32Array(1))[0] %
      1_000_000_000);

  return Array.from({ length: count }, (_, index) => {
    const productNumber = index + 1;

    const price =
      Math.floor(Math.random() * 300) + 50;

    const oldPrice =
      price + Math.floor(Math.random() * 200) + 10;

    return {
      ...template,

      id: randomBase + index,

      nameUa:
        `${template.nameUa} TEST ${productNumber}`,

      nameRu:
        `${template.nameRu} TEST ${productNumber}`,

      price,
      oldPrice,

      pictures: oversizedImage
        ? [OVERSIZED_IMAGE_URL]
        : generatePicturesForProduct(),

      params: template.params.map((param) => ({
        ...param,
      })),
    };
  });
}


// ======================================================
// CLOUDFLARE WORKER
// ======================================================

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== "/products.xml") {
      return new Response("Not Found", {
        status: 404,
      });
    }


    // --------------------------------------------------
    // COUNT
    // --------------------------------------------------

    const requestedCount = Number(
      url.searchParams.get("count") ?? "10"
    );

    const count =
      Number.isFinite(requestedCount)
        ? Math.min(
            Math.max(Math.floor(requestedCount), 1),
            1000
          )
        : 10;


    // --------------------------------------------------
    // FILTER PARAMETERS
    // --------------------------------------------------

    const characteristic =
      url.searchParams.get("characteristic");

    const characteristicValue =
      url.searchParams.get("value");

    const oversizedImage =
      url.searchParams.get("oversizedImage") ===
      "true";


    // --------------------------------------------------
    // GENERATE PRODUCTS
    // --------------------------------------------------

    const generatedProducts =
      generateProducts(
        count,
        oversizedImage
      );


    // --------------------------------------------------
    // FILTER PRODUCTS BY CHARACTERISTIC
    // --------------------------------------------------

    let filteredProducts =
      generatedProducts;

    if (characteristic) {
      filteredProducts =
        filteredProducts.filter((product) =>
          product.params.some((param) => {
            const matchesName =
              param.name.toLowerCase() ===
              characteristic.toLowerCase();

            if (!matchesName) {
              return false;
            }

            if (!characteristicValue) {
              return true;
            }

            return (
              param.value.toLowerCase() ===
              characteristicValue.toLowerCase()
            );
          })
        );
    }


    // --------------------------------------------------
    // FINAL PRODUCT LIST
    // --------------------------------------------------

    const selectedProducts =
      filteredProducts.slice(0, count);

    const selectedCount =
      selectedProducts.length;


    // --------------------------------------------------
    // GENERATE XML
    // --------------------------------------------------

    const offersXml =
      selectedProducts
        .map((product) =>
          generateOffer(product)
        )
        .join("\n");

    const categoriesXml =
      generateCategories(
        selectedProducts
      );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog>
  <shop>
    <categories>
${categoriesXml}
    </categories>

    <products_count>${selectedCount}</products_count>

    <offers>
${offersXml}
    </offers>
  </shop>
</yml_catalog>`;


    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return new Response(xml, {
      headers: {
        "Content-Type":
          "application/xml; charset=UTF-8",

        "Cache-Control":
          "no-store",

        "X-Robots-Tag":
          "noindex",
      },
    });
  },
};


// ======================================================
// XML HELPERS
// ======================================================

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}


function generateParams(
  product: Product
): string {
  return product.params
    .map(
      (param) =>
        `        <param name="${escapeXml(
          param.name
        )}">${escapeXml(
          param.value
        )}</param>`
    )
    .join("\n");
}


function generatePictures(
  product: Product
): string {
  return product.pictures
    .map(
      (picture) =>
        `        <picture>${escapeXml(
          picture
        )}</picture>`
    )
    .join("\n");
}


function generateOffer(
  product: Product
): string {
  return `      <offer id="${product.id}" available="${product.available}">
        <name_ua>${escapeXml(product.nameUa)}</name_ua>
        <name_ru>${escapeXml(product.nameRu)}</name_ru>

        <description_ua>${escapeXml(product.descriptionUa)}</description_ua>
        <description_ru>${escapeXml(product.descriptionRu)}</description_ru>

        <price>${product.price}</price>
        ${
          product.oldPrice !== undefined
            ? `<old_price>${product.oldPrice}</old_price>`
            : ""
        }

        <categoryId>${product.categoryId}</categoryId>

        <vendor>${escapeXml(product.vendor)}</vendor>
        <country>${escapeXml(product.country)}</country>

        <temperature_mode>${escapeXml(
          product.temperatureMode
        )}</temperature_mode>

${generatePictures(product)}

${generateParams(product)}
      </offer>`;
}


function generateCategories(
  products: Product[]
): string {
  const uniqueCategories =
    new Map<
      string,
      {
        categoryId: number;
        categoryName: string;
        portalId: PortalId;
      }
    >();

  for (const product of products) {
    const key =
      `${product.categoryId}-${product.portalId}`;

    if (!uniqueCategories.has(key)) {
      uniqueCategories.set(key, {
        categoryId:
          product.categoryId,

        categoryName:
          product.categoryName,

        portalId:
          product.portalId,
      });
    }
  }

  return Array.from(
    uniqueCategories.values()
  )
    .map(
      (category) =>
        `      <category id="${category.categoryId}" portal_id="${category.portalId}">${escapeXml(
          category.categoryName
        )}</category>`
    )
    .join("\n");
}