import { getShopifyApiVersion } from './shopify/config';

export interface UpdateShopifyPriceParams {
  shop: string;
  accessToken: string;
  productId?: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  sku?: string;
  productName?: string;
  newPrice: number;
  oldPrice?: number;
  compareAtPrice?: number;
  updateAllVariants?: boolean;
}

export interface UpdateShopifyPriceResult {
  success: boolean;
  variantId?: string;
  price?: number;
  compareAtPrice?: number | null;
  error?: string;
  status?: number;
  scopeMissing?: string;
  skipped?: boolean;
  readOnlyMode?: boolean;
  reinstallRequired?: boolean;
  updatedVariantsCount?: number;
}

function sanitizeShopDomain(rawShop: string): string | null {
  if (!rawShop) return null;
  let shop = rawShop.trim().toLowerCase();
  shop = shop.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!shop.includes('.myshopify.com')) {
    shop = `${shop}.myshopify.com`;
  }
  const validShopRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
  return validShopRegex.test(shop) ? shop : null;
}

/**
 * Updates a product variant price (and optional compare_at_price) in Shopify Admin REST API.
 */
export async function updateShopifyVariantPrice(
  params: UpdateShopifyPriceParams
): Promise<UpdateShopifyPriceResult> {
  const apiVersion = getShopifyApiVersion();
  const {
    shop: rawShop,
    accessToken,
    productId,
    shopifyProductId,
    shopifyVariantId,
    sku,
    productName,
    newPrice,
    oldPrice,
    compareAtPrice,
  } = params;

  const shop = sanitizeShopDomain(rawShop);
  if (!shop) {
    return { success: false, error: 'Invalid Shopify store URL format.' };
  }

  if (!accessToken || !accessToken.trim()) {
    return { success: false, error: 'Shopify access token is required.' };
  }

  if (newPrice === undefined || isNaN(Number(newPrice)) || Number(newPrice) < 0) {
    return { success: false, error: 'Valid non-negative price is required.' };
  }

  const headers = {
    'X-Shopify-Access-Token': accessToken.trim(),
    'Content-Type': 'application/json',
  };

  let targetVariantId: string | null = null;
  let allProductVariantIds: string[] = [];

  // 1. Direct variant ID from parameter
  if (shopifyVariantId && shopifyVariantId !== 'default' && shopifyVariantId !== '0') {
    targetVariantId = String(shopifyVariantId);
  }

  // 2. Parse from canonical ID format: shopify_{productId}_{variantId}
  if (!targetVariantId && productId && productId.startsWith('shopify_')) {
    const parts = productId.split('_');
    if (parts.length >= 3 && parts[2] !== 'default' && !isNaN(Number(parts[2]))) {
      targetVariantId = parts[2];
    }
  }

  // 3. Look up via Shopify Product ID if variant not yet resolved
  const resolvedProdId =
    shopifyProductId ||
    (productId && productId.startsWith('shopify_') ? productId.split('_')[1] : null);

  if (resolvedProdId && !isNaN(Number(resolvedProdId))) {
    try {
      const prodRes = await fetch(
        `https://${shop}/admin/api/${apiVersion}/products/${resolvedProdId}.json`,
        { method: 'GET', headers, signal: AbortSignal.timeout(12000) }
      );
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const variants = prodData.product?.variants || [];
        if (variants.length > 0) {
          allProductVariantIds = variants.map((v: any) => String(v.id));
          if (!targetVariantId && sku) {
            const matchSku = variants.find(
              (v: any) => (v.sku || '').trim().toLowerCase() === sku.trim().toLowerCase()
            );
            if (matchSku) targetVariantId = String(matchSku.id);
          }
          if (!targetVariantId) {
            targetVariantId = String(variants[0].id);
          }
        }
      }
    } catch (lookupErr) {
      console.warn('[Shopify Price Sync] Error fetching product for variant lookup:', lookupErr);
    }
  }

  // 4. Look up variant by SKU across store products
  if (!targetVariantId && sku && sku.trim()) {
    try {
      const skuSearchRes = await fetch(
        `https://${shop}/admin/api/${apiVersion}/products.json?limit=250&fields=id,title,variants`,
        { method: 'GET', headers, signal: AbortSignal.timeout(15000) }
      );
      if (skuSearchRes.ok) {
        const data = await skuSearchRes.json();
        const products = data.products || [];
        for (const p of products) {
          const matchingVar = (p.variants || []).find(
            (v: any) => (v.sku || '').trim().toLowerCase() === sku.trim().toLowerCase()
          );
          if (matchingVar) {
            targetVariantId = String(matchingVar.id);
            allProductVariantIds = (p.variants || []).map((v: any) => String(v.id));
            break;
          }
        }
      }
    } catch (skuErr) {
      console.warn('[Shopify Price Sync] Error searching by SKU:', skuErr);
    }
  }

  if (!targetVariantId) {
    return {
      success: false,
      error: `Could not identify Shopify variant ID for "${productName || productId || sku || 'Product'}". Ensure product exists on Shopify.`,
    };
  }

  // Determine compare_at_price for discount representation
  let finalCompareAtPrice: number | null = null;
  const numNew = Number(newPrice);

  if (compareAtPrice !== undefined && Number(compareAtPrice) > numNew) {
    finalCompareAtPrice = Number(compareAtPrice);
  } else if (oldPrice !== undefined && Number(oldPrice) > numNew) {
    finalCompareAtPrice = Number(oldPrice);
  }

  try {
    const updatePayload: Record<string, any> = {
      id: targetVariantId,
      price: numNew.toFixed(2),
    };

    if (finalCompareAtPrice !== null) {
      updatePayload.compare_at_price = finalCompareAtPrice.toFixed(2);
    }

    console.log(`[Shopify Price Sync] Sending PUT to https://${shop}/admin/api/${apiVersion}/variants/${targetVariantId}.json`, updatePayload);

    const putRes = await fetch(
      `https://${shop}/admin/api/${apiVersion}/variants/${targetVariantId}.json`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ variant: updatePayload }),
        signal: AbortSignal.timeout(15000),
      }
    );

    console.log(`[Shopify Price Sync] Response status: ${putRes.status}`);

    if (putRes.status === 401) {
      return {
        success: false,
        status: 401,
        error: 'Shopify authentication failed (401). Invalid or revoked access token.',
      };
    }

    if (putRes.status === 403) {
      return {
        success: false,
        status: 403,
        scopeMissing: 'write_products',
        reinstallRequired: true,
        error: 'Shopify permission denied (403): If you recently added "write_products" in Shopify Admin, you must click "Reinstall app" under API credentials to activate it for this token.',
      };
    }

    if (putRes.status === 404) {
      return {
        success: false,
        status: 404,
        error: `Shopify variant #${targetVariantId} not found (404).`,
      };
    }

    if (putRes.status === 429) {
      return {
        success: false,
        status: 429,
        error: 'Shopify API rate limit reached (429). Please wait a moment.',
      };
    }

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.warn(`[Shopify Price Sync] PUT failed (${putRes.status}):`, errText);
      return {
        success: false,
        status: putRes.status,
        error: `Shopify API error (${putRes.status}): Failed to update price.`,
      };
    }

    const responseData = await putRes.json();
    const updatedVar = responseData.variant || {};
    let updatedCount = 1;

    // Only update sibling variants if explicitly requested via updateAllVariants.
    // By default, price updates strictly target only the selected variant (e.g. specific shoe size) so sibling sizes are not changed.
    if (params.updateAllVariants && allProductVariantIds.length > 1) {
      const siblingIds = allProductVariantIds.filter(id => id !== targetVariantId);
      for (const sibId of siblingIds) {
        try {
          const sibRes = await fetch(
            `https://${shop}/admin/api/${apiVersion}/variants/${sibId}.json`,
            {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                variant: {
                  id: sibId,
                  price: numNew.toFixed(2),
                  ...(finalCompareAtPrice !== null ? { compare_at_price: finalCompareAtPrice.toFixed(2) } : {}),
                },
              }),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (sibRes.ok) updatedCount++;
        } catch (sibErr) {
          console.warn(`[Shopify Price Sync] Sibling variant #${sibId} update error:`, sibErr);
        }
      }
    }

    return {
      success: true,
      variantId: targetVariantId,
      price: Number(updatedVar.price || numNew),
      compareAtPrice: updatedVar.compare_at_price ? Number(updatedVar.compare_at_price) : finalCompareAtPrice,
      updatedVariantsCount: updatedCount,
    };
  } catch (err: any) {
    console.error('[Shopify Price Sync Network Error]:', err);
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return {
      success: false,
      error: isTimeout
        ? 'Shopify price sync request timed out (15s).'
        : (err?.message || 'Failed to update price in Shopify.'),
    };
  }
}
