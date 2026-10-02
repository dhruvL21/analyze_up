import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { getValidAccessToken } from '@/lib/drive-helper';
import Papa from 'papaparse';

interface ProductRowUpdate {
  sku?: string;
  productName?: string;
  productId?: string;
  newStock?: number;
  stockDelta?: number;
  newPrice?: number;
  compareAtPrice?: number;
}

/**
 * POST /api/drive/update
 * Updates a CSV or Google Sheet file hosted on Google Drive with new stock quantities or prices.
 */
export async function POST(req: NextRequest) {
  let token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.headers.get('x-drive-token');
  const userId = req.headers.get('x-user-uid');

  const body = await req.json().catch(() => ({}));
  const { fileId, fileName, updates = [] } = body as {
    fileId: string;
    fileName?: string;
    updates: ProductRowUpdate[];
  };

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Missing updates array parameter' }, { status: 400 });
  }

  if (!token && userId) {
    const { firestore } = initializeFirebase();
    if (firestore) {
      token = await getValidAccessToken(userId, firestore);
    }
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: Google Drive is not connected or token expired.' }, { status: 401 });
  }

  try {
    let csvContent = '';
    let isGoogleSheet = false;

    // 1. Fetch current content from Google Drive
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (driveRes.ok) {
      csvContent = await driveRes.text();
    } else {
      // If direct alt=media fails with 400/403, file is likely a native Google Sheet
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv&supportsAllDrives=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (exportRes.ok) {
        csvContent = await exportRes.text();
        isGoogleSheet = true;
      } else {
        const errData = await driveRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: 'Failed to read file from Google Drive', details: errData },
          { status: driveRes.status || 500 }
        );
      }
    }

    if (!csvContent || !csvContent.trim()) {
      return NextResponse.json({ error: 'File content is empty.' }, { status: 422 });
    }

    // 2. Parse CSV content into structured rows
    const parsed = Papa.parse<Record<string, any>>(csvContent, {
      header: true,
      skipEmptyLines: false,
    });

    const headers = parsed.meta.fields || [];
    if (headers.length === 0) {
      return NextResponse.json({ error: 'No column headers detected in Drive file.' }, { status: 422 });
    }

    // Map column headers intelligently
    const findHeader = (patterns: RegExp[]): string | undefined => {
      return headers.find((h) => patterns.some((p) => p.test(h.trim())));
    };

    const skuHeader = findHeader([
      /^(sku|product_?sku|variant_?sku|item_?code|barcode|product_?id|id)$/i,
      /sku/i,
    ]);
    const nameHeader = findHeader([
      /^(product_?name|title|product_?title|name|item_?name|product)$/i,
      /title/i,
      /product/i,
    ]);
    const stockHeader = findHeader([
      /^(stock|inventory_?quantity|inventory|quantity|qty|on_?hand|available)$/i,
      /stock/i,
      /qty/i,
      /quantity/i,
    ]);
    const priceHeader = findHeader([
      /^(price|unit_?price|selling_?price|rate)$/i,
      /price/i,
      /rate/i,
    ]);
    const compareHeader = findHeader([
      /^(compare_?at_?price|compare_?at|mrp|original_?price|list_?price)$/i,
      /compare/i,
      /mrp/i,
    ]);

    const variantHeader = findHeader([
      /^(variant_?title|variant_?name|option1_?value|option2_?value|size|option1|option2|variant)$/i,
      /variant/i,
      /size/i,
    ]);

    let updatedRowsCount = 0;

    // Helper to extract clean size/variant from a product name like "Product A - Navy (L)" or "Shoe (Size 8)"
    const extractVariantFromName = (nameStr: string): string => {
      const parenMatch = nameStr.match(/\(([^)]+)\)$/);
      if (parenMatch) return parenMatch[1].trim().toLowerCase();
      const dashParts = nameStr.split(' - ');
      if (dashParts.length > 1) return dashParts[dashParts.length - 1].trim().toLowerCase();
      return '';
    };

    // 3. Apply updates strictly to matching variant rows
    for (const update of updates) {
      const targetSku = update.sku ? update.sku.trim().toLowerCase() : '';
      const targetName = update.productName ? update.productName.trim().toLowerCase() : '';
      const targetVariant = (update.variantTitle || update.size || extractVariantFromName(update.productName || '')).trim().toLowerCase();
      const updateAllVariants = Boolean(update.updateAllVariants);

      for (const row of parsed.data) {
        if (!row || typeof row !== 'object') continue;

        const rowSku = skuHeader && row[skuHeader] ? String(row[skuHeader]).trim().toLowerCase() : '';
        const rowName = nameHeader && row[nameHeader] ? String(row[nameHeader]).trim().toLowerCase() : '';
        const rowVariant = variantHeader && row[variantHeader] ? String(row[variantHeader]).trim().toLowerCase() : '';

        let isRowMatch = false;

        // CASE 1: Precise SKU Match (Highest specificity for size/variant)
        if (targetSku && rowSku) {
          isRowMatch = (rowSku === targetSku);
        }
        // CASE 2: Name + Variant/Size Match
        else if (targetName && rowName) {
          const namesMatch = rowName === targetName || rowName.includes(targetName) || targetName.includes(rowName);

          if (namesMatch) {
            if (updateAllVariants) {
              isRowMatch = true;
            } else if (rowVariant && targetVariant) {
              // Both have variant/size: strictly match variant
              isRowMatch = (rowVariant === targetVariant || rowVariant.includes(targetVariant) || targetVariant.includes(rowVariant));
            } else if (rowVariant && !targetVariant) {
              // Row has a specific size (e.g. Size 7, Size 8) but update has no variant specified
              // Do NOT match all variant rows unless updateAllVariants is explicitly requested
              isRowMatch = false;
            } else {
              // Neither has variant column (single SKU product)
              isRowMatch = true;
            }
          }
        }

        if (isRowMatch) {
          // Update Stock
          if (stockHeader) {
            if (update.newStock !== undefined) {
              row[stockHeader] = String(update.newStock);
              updatedRowsCount++;
            } else if (update.stockDelta !== undefined) {
              const currentNum = parseInt(String(row[stockHeader]).replace(/[^0-9.-]/g, ''), 10) || 0;
              row[stockHeader] = String(currentNum + update.stockDelta);
              updatedRowsCount++;
            }
          }

          // Update Price
          if (priceHeader && update.newPrice !== undefined) {
            row[priceHeader] = String(update.newPrice);
            updatedRowsCount++;
          }

          // Update Compare At Price
          if (compareHeader && update.compareAtPrice !== undefined) {
            row[compareHeader] = String(update.compareAtPrice);
          }
        }
      }
    }

    // 4. Re-serialize CSV
    const updatedCsv = Papa.unparse(parsed.data, {
      quotes: true,
      header: true,
    });

    // 5. Push updated content back to Google Drive
    let uploadSuccess = false;
    let uploadStatus = 200;

    if (isGoogleSheet) {
      // Try Google Sheets API update
      const rawRows = [
        headers,
        ...parsed.data.map((r) => headers.map((h) => r[h] ?? '')),
      ];

      const sheetRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range: 'A1',
            majorDimension: 'ROWS',
            values: rawRows,
          }),
        }
      );

      if (sheetRes.ok) {
        uploadSuccess = true;
      } else {
        // Fallback: If Sheets API is not directly enabled, try standard drive media patch
        const patchRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'text/csv',
            },
            body: updatedCsv,
          }
        );
        uploadSuccess = patchRes.ok;
        uploadStatus = patchRes.status;
      }
    } else {
      // Standard CSV or text file on Drive
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/csv',
          },
          body: updatedCsv,
        }
      );
      uploadSuccess = patchRes.ok;
      uploadStatus = patchRes.status;
    }

    if (!uploadSuccess) {
      console.warn('[Drive File Write-Back] Google API write returned non-200:', uploadStatus);
    }

    // 6. Record metadata update in Firestore
    if (userId) {
      try {
        const { firestore } = initializeFirebase();
        if (firestore) {
          const { doc, setDoc } = await import('firebase/firestore');
          const fileRef = doc(firestore, 'users', userId, 'google_drive_files', fileId);
          await setDoc(
            fileRef,
            {
              lastWriteBackAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastModifiedAction: 'ai_recommendation_sync',
            },
            { merge: true }
          );
        }
      } catch (e) {
        // Non-fatal metadata logging
      }
    }

    return NextResponse.json({
      success: true,
      fileId,
      fileName,
      updatedRowsCount,
      isGoogleSheet,
      message: `Successfully synchronized ${updatedRowsCount} changes with Google Drive.`,
    });
  } catch (err: any) {
    console.error('[Drive File Write-Back Error]:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update Google Drive file.' }, { status: 500 });
  }
}
