/**
 * Shared PDF utilities using pdf-lib and PDF.js
 * - Load pdf-lib from CDN
 * - Copy pages between documents
 * - Load PDF document from Uint8Array
 */

// CDN links
const PDF_LIB_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';

/**
 * Load pdf-lib library dynamically from CDN
 * Returns the pdfLib object
 */
export async function loadPdfLib() {
    // Check if already loaded
    if (window.pdfLib) return window.pdfLib;
    if (window.PDFLib) {
        window.pdfLib = window.PDFLib;
        return window.pdfLib;
    }

    // Load from CDN
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    // Check both possible global names
    if (window.pdfLib) return window.pdfLib;
    if (window.PDFLib) {
        window.pdfLib = window.PDFLib;
        return window.pdfLib;
    }

    throw new Error('pdf-lib library failed to load. Please check your internet connection.');
}

/**
 * Create a new PDF document with pdf-lib
 */
export async function createNewPdf(pdfLib) {
    return await pdfLib.PDFDocument.create();
}

/**
 * Load an existing PDF from Uint8Array
 */
export async function loadPdfDocument(pdfLib, data) {
    return await pdfLib.PDFDocument.load(data);
}

/**
 * Copy all pages from sourceDoc to targetDoc
 * Returns array of copied page references
 */
export async function copyAllPages(sourceDoc, targetDoc) {
    const indices = sourceDoc.getPageIndices();
    const copiedPages = [];
    for (const index of indices) {
        const [page] = await targetDoc.copyPages(sourceDoc, [index]);
        targetDoc.addPage(page);
        copiedPages.push(page);
    }
    return copiedPages;
}

/**
 * Copy specific pages by index (0-based)
 */
export async function copyPagesByIndex(sourceDoc, targetDoc, pageIndices) {
    const pages = await targetDoc.copyPages(sourceDoc, pageIndices);
    for (const page of pages) {
        targetDoc.addPage(page);
    }
    return pages;
}

/**
 * Save PDF document as Uint8Array
 */
export async function savePdf(doc) {
    return await doc.save();
}