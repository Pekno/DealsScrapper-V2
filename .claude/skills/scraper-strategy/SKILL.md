---
name: scraper-strategy
description: >
  Load this skill when implementing category discovery, adding filterable fields, or
  understanding Dealabs scraping coverage in DealsScrapper. Contains the multi-level category
  discovery architecture (main groups, brand/product, hub categories, special filter pages),
  the two-phase scraping flow (discovery + extraction), and the complete filterable fields
  catalogue organized by tier (Tier 1 essential, Tier 2 standard, Tier 3 advanced).
  Invoke when working on category discovery, new scraping fields, or filter field definitions.
---

# Comprehensive Dealabs Scraping Strategy

## Multi-Level Category Discovery System

### 1. Main Groups (`/groupe/`)

13 primary sections on Dealabs:

| Group | Example sub-items |
|---|---|
| High-Tech | SSD, Smartphones, Téléviseurs, iPhone, Samsung, Garmin |
| Consoles & Jeux vidéo | Xbox, PlayStation, Nintendo Switch, PC gaming, Pokémon |
| Épicerie & Courses | Lessive, Alimentation, Champagne, Chocolat, Café |
| Mode & Accessoires | Chaussures, Montres, Nike Air Max, New Balance, Seiko |
| Santé & Cosmétiques | Oral-B, Parfums, Papier toilette, Beauté, Philips Lumea |
| Voyages | Vols, Séjours, Location voiture, Hôtels, Festivals |
| Famille & Enfants | Lego, Pampers, Couches, Playmobil, Funko Pop |
| Maison & Habitat | Matelas, Tefal, Roborock, Climatisation, Lave-vaisselle |
| Jardin & Bricolage | Barbecue, Robot tondeuse, Makita, Outillage |
| Auto-Moto | Pneus, Huile moteur, Carburant, Accessoires moto |
| Culture & Divertissement | Blu-ray, Futuroscope, Parc Astérix, Disneyland Paris |
| Sports & Plein air | Nike, VTT, Whey, Vélos électriques, Trottinettes |
| Services | Spotify, Netflix, Deezer, Streaming, Restaurants |

### 2. Brand/Product-Specific Groups

URL pattern: `/groupe/<slug>` — e.g. `/groupe/nike`, `/groupe/xbox`, `/groupe/iphone`, `/groupe/nintendo-switch`, `/groupe/smartphones-samsung`.

### 3. Hub Categories

URL pattern: `/groupe/hub/<slug>` — hierarchical sub-groupings, e.g. `/groupe/hub/consoles-jeux-video`, `/groupe/hub/high-tech`.

### 4. Special Filter Pages

URL pattern: `/groupe/<slug>-hot` — temperature-filtered results with community validation (e.g. `/groupe/nintendo-switch-hot`).

---

## Dynamic Scraping Architecture

### Phase 1: Category Discovery

```typescript
async scrapeCategoryStructure() {
  const mainCategories = await this.scrapeMainGroups('/groupe/');

  for (const category of mainCategories) {
    const subCategories = await this.scrapeSubCategories(category.url);
    const hubCategories = await this.checkHubVariations(category.slug);
    const brandGroups  = await this.discoverBrandGroups(category.slug);
  }
}
```

### Phase 2: Product Data Extraction

```typescript
async scrapeDealsFromCategory(categoryUrl: string) {
  const deals = await this.extractDeals(categoryUrl);

  for (const deal of deals) {
    const enrichedDeal = {
      ...deal,
      categoryHierarchy: this.buildCategoryPath(categoryUrl),
      filterableFields:  await this.extractFilterableFields(deal),
      communityMetrics:  await this.extractCommunityData(deal),
    };
  }
}
```

---

## Complete Filterable Fields Catalogue

### Core Product Information

| Field | Description |
|---|---|
| `title` | Product name/description |
| `brand` | Manufacturer (Nike, Samsung, Apple…) |
| `model` | Specific product model |
| `sku` | Product SKU/reference number |
| `category` | Primary category (High-Tech, Mode…) |
| `subcategory` | Secondary category (Smartphones, Chaussures…) |
| `productType` | Specific type (iPhone, MacBook…) |

### Pricing & Financial Data

| Field | Description |
|---|---|
| `currentPrice` | Final price after all discounts |
| `originalPrice` | Price before discounts |
| `discountPercentage` | Percentage reduction |
| `discountAmount` | Absolute savings amount |
| `priceHistory` | Historical price tracking |
| `cashbackAmount` | Available cashback value |
| `loyaltyPoints` | Store loyalty points earned |
| `freeShipping` | Boolean — free shipping availability |
| `minimumOrderValue` | Minimum spend for promotions |

### Merchant & Store Information

| Field | Description |
|---|---|
| `merchant` | Store name (Amazon, Fnac, Boulanger…) |
| `merchantType` | Official store vs third-party vendor |
| `merchantRating` | Store reliability rating |
| `vendorCategory` | "Vendeur Tiers" classification |
| `storeLocation` | Physical store availability |
| `pickupAvailable` | In-store pickup option |
| `deliveryMethods` | Available shipping options |
| `warrantyProvider` | Who provides warranty coverage |

### Deal Classification & Metadata

| Field | Description |
|---|---|
| `dealType` | Direct deal, coupon, cashback, bundle |
| `exclusivityLevel` | Public, member-only, app-exclusive |
| `urgencyIndicators` | Flash sale, limited time, ending soon |
| `stockLevel` | Availability indicators |
| `membershipRequired` | Special membership needed |
| `ageRestriction` | Age verification requirements |
| `geographicRestrictions` | France-only, EU-only, border shopping |

### Temporal Information

| Field | Description |
|---|---|
| `publishedAt` | When deal was posted |
| `updatedAt` | Last modification time |
| `expiresAt` | Deal expiration date/time |
| `scrapedAt` | When data was collected |
| `dealAge` | Time since posting |
| `timeRemaining` | Time until expiration |
| `promotionalPeriod` | Event context (Black Friday…) |

### Community Engagement Metrics

| Field | Description |
|---|---|
| `temperature` | Community heat score (Dealabs unique metric) |
| `voteCount` | Total votes received |
| `upvotes` | Positive votes |
| `downvotes` | Negative votes |
| `commentCount` | Number of comments |
| `viewCount` | Deal view count |
| `shareCount` | Social sharing count |
| `contributorLevel` | Poster reputation (Bronze/Silver/Gold/Platinum) |
| `communityVerified` | Community-verified authenticity |

### Product Specifications (Category-Specific)

Scraped only when available for the relevant category:

| Category | Key fields |
|---|---|
| Electronics/High-Tech | `screenSize`, `storage`, `memory`, `processor`, `connectivity`, `compatibility`, `resolution`, `batteryLife`, `colorOptions`, `condition` |
| Fashion/Mode | `sizeRange`, `material`, `colorOptions`, `gender`, `season`, `style`, `care` |
| Home/Maison | `dimensions`, `weight`, `capacity`, `energyRating`, `noiseLevels`, `installationType`, `roomType` |
| Gaming/Consoles | `platform`, `generation`, `gameMode`, `onlineFeatures`, `controllerIncluded`, `storageExpandable`, `vr_compatible` |

### Search & Matching Fields

`keywords`, `tags`, `searchTerms`, `relatedProducts`, `alternatives`, `bundles`

### Quality & Trust Indicators

`dealQualityScore`, `priceHistoryTrend`, `merchantTrustScore`, `communityConsensus`, `authenticityVerified`, `warrantyStatus`, `returnPolicy`

### API Integration Fields

`affiliateLinks`, `apiProductId`, `trackingPixels`, `deepLinks`, `socialMediaIds`

---

## Filter Implementation Priority

### Tier 1 — Essential (implement first)

1. **Price Range**: `currentPrice`, `discountPercentage`
2. **Category/Brand**: `category`, `subcategory`, `brand`
3. **Quality**: `temperature`, `communityVerified`
4. **Merchant**: `merchant`, `merchantType`
5. **Availability**: `stockLevel`, `expiresAt`

### Tier 2 — Standard (implement second)

1. **Deal Type**: `dealType`, `exclusivityLevel`
2. **Shipping**: `freeShipping`, `pickupAvailable`
3. **Community**: `commentCount`, `voteCount`
4. **Temporal**: `dealAge`, `urgencyIndicators`

### Tier 3 — Advanced (implement third)

1. **Product Specs**: Category-specific technical fields (see table above)
2. **Geographic**: `geographicRestrictions`, `storeLocation`
3. **Historical**: `priceHistory`, `priceHistoryTrend`
4. **Engagement**: `viewCount`, `shareCount`
