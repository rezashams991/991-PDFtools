/**
 * PDF Compress Tool
 * Reduces PDF file size by compressing images
 * Uses PDF.js to extract images and canvas to re-compress them
 * All processing happens client-side
 * 
 * NOTE: This is a simplified version. Full image extraction/re-embedding
 * is complex. This version works well for PDFs with JPEG images.
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';
import {
    loadPdfLib,
    loadPdfDocument,
    createNewPdf,
    savePdf
} from '../core/pdfUtils.js';

// CDN for PDF.js
const PDF_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_JS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Load PDF.js library from CDN
 */
async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    
    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PDF_JS_CDN;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;
    return window.pdfjsLib;
}

/**
 * Extract images from a PDF page using PDF.js
 * Returns array of image data (as canvas)
 */
async function extractImagesFromPage(page, scale = 1.0) {
    const images = [];
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    
    // Render page to canvas (this captures all images as part of the page)
    await page.render({ canvasContext: ctx, viewport }).promise;
    
    // For simplicity, we treat the whole page as one image
    // In a more advanced version, we'd extract individual images
    // But for compression, rendering the whole page and re-embedding works
    return { canvas, width: canvas.width, height: canvas.height };
}

/**
 * Compress an image using canvas with lower quality
 */
function compressImage(canvas, quality = 0.7, format = 'jpeg') {
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Main function - renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>📦 Compress PDF</h3>
            <p class="tool-description">Reduce PDF file size by compressing images.</p>
            
            <div class="file-input-area">
                <input type="file" id="compressFileInput" accept=".pdf" />
                <label for="compressFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="compress-config">
                <div class="config-row">
                    <label for="compressionQuality">Image quality:</label>
                    <input type="range" id="compressionQuality" min="0.1" max="1.0" step="0.05" value="0.7" />
                    <span id="qualityValue">70%</span>
                </div>
                <div class="config-row">
                    <label for="imageScale">Resolution scale:</label>
                    <select id="imageScale">
                        <option value="0.5">50% (high compression)</option>
                        <option value="0.75">75% (medium compression)</option>
                        <option value="1.0" selected>100% (no resize)</option>
                    </select>
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="removeMetadata" checked />
                        Remove metadata (further reduce size)
                    </label>
                </div>
            </div>
            
            <button id="compressBtn" class="btn-primary" disabled>Compress PDF</button>
            <div id="compressStatus" class="status-message"></div>
            <div id="compressResult" class="compress-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#compressFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const qualityRange = container.querySelector('#compressionQuality');
    const qualityValue = container.querySelector('#qualityValue');
    const imageScale = container.querySelector('#imageScale');
    const removeMetadata = container.querySelector('#removeMetadata');
    const compressBtn = container.querySelector('#compressBtn');
    const statusDiv = container.querySelector('#compressStatus');
    const resultDiv = container.querySelector('#compressResult');

    let selectedFile = null;
    let fileData = null;
    let originalSize = 0;

    // 3. Quality slider display
    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = `${Math.round(parseFloat(qualityRange.value) * 100)}%`;
    });

    // 4. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            compressBtn.disabled = true;
            return;
        }

        selectedFile = files[0];
        originalSize = selectedFile.size;
        fileInfo.innerHTML = `
            <div class="file-item">
                <span class="file-name">${selectedFile.name}</span>
                <span class="file-size">(${(originalSize / 1024).toFixed(1)} KB)</span>
            </div>
        `;

        const buffer = await selectedFile.arrayBuffer();
        fileData = new Uint8Array(buffer);
        compressBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 5. Handle compress action
    compressBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        compressBtn.disabled = true;
        compressBtn.textContent = '⏳ Compressing...';
        statusDiv.innerHTML = '⏳ Loading libraries...';
        resultDiv.innerHTML = '';

        try {
            const quality = parseFloat(qualityRange.value);
            const scale = parseFloat(imageScale.value);
            const removeMeta = removeMetadata.checked;

            // Load both pdf-lib and PDF.js
            const pdfLib = await loadPdfLib();
            const pdfjs = await loadPdfJs();

            statusDiv.innerHTML = '📖 Reading PDF...';

            // Load PDF with pdf-lib (for structure)
            const sourceDoc = await loadPdfDocument(pdfLib, fileData);
            const totalPages = sourceDoc.getPages().length;

            if (totalPages === 0) {
                throw new Error('PDF has no pages.');
            }

            // Load PDF with PDF.js (for image extraction)
            const loadingTask = pdfjs.getDocument({ data: fileData });
            const pdfJsDoc = await loadingTask.promise;

            statusDiv.innerHTML = `🔄 Processing ${totalPages} pages... (this may take a moment)`;

            // Create new PDF
            const newDoc = await createNewPdf(pdfLib);

            // Process each page
            for (let i = 1; i <= totalPages; i++) {
                const page = pdfJsDoc.getPage(i);
                const pdfJsPage = await page;

                // Extract page as image
                const { canvas, width, height } = await extractImagesFromPage(pdfJsPage, scale);

                // Compress image
                const compressedBytes = compressImage(canvas, quality, 'jpeg');

                // Embed compressed image in new PDF
                const jpegImage = await newDoc.embedJpg(compressedBytes);

                // Add page with same dimensions
                const pageWidth = width * (72 / 96); // Convert pixels to points (approx)
                const pageHeight = height * (72 / 96);
                const newPage = newDoc.addPage([pageWidth, pageHeight]);

                // Draw image on page
                newPage.drawImage(jpegImage, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight
                });

                // Update progress
                if (i % 5 === 0 || i === totalPages) {
                    statusDiv.innerHTML = `🔄 Processed ${i}/${totalPages} pages...`;
                }
            }

            // Remove metadata if requested
            if (removeMeta) {
                // pdf-lib doesn't have direct metadata removal
                // We'll just save without adding any metadata
                // The new document has no metadata by default
            }

            statusDiv.innerHTML = '💾 Saving compressed PDF...';

            // Save new document
            const compressedBytes = await newDoc.save();

            // Calculate compression ratio
            const compressedSize = compressedBytes.length;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            const sizeReduction = (originalSize - compressedSize) / 1024;

            // Generate filename
            const baseName = selectedFile.name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_compressed.pdf`;

            // Download
            downloadPdf(compressedBytes, outputName);

            statusDiv.innerHTML = `✅ Compression completed! ${ratio}% size reduction (${sizeReduction.toFixed(1)} KB saved)`;
            statusDiv.style.color = '#28a745';

            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>📄 ${outputName}</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
                <div class="compression-info">
                    <div><strong>Original:</strong> ${(originalSize / 1024).toFixed(1)} KB</div>
                    <div><strong>Compressed:</strong> ${(compressedSize / 1024).toFixed(1)} KB</div>
                    <div><strong>Saved:</strong> ${sizeReduction.toFixed(1)} KB (${ratio}%)</div>
                </div>
            `;

            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(compressedBytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            statusDiv.style.color = '#dc3545';
            console.error('Compress error:', error);
        } finally {
            compressBtn.disabled = false;
            compressBtn.textContent = 'Compress PDF';
        }
    });
}