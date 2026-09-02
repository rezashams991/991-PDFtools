/**
 * PDF to Image Tool
 * Converts each page of a PDF to JPG or PNG images
 * Uses PDF.js for rendering and Canvas for export
 * All processing happens client-side
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';

// CDN links
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
    
    // Set worker source
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;
    return window.pdfjsLib;
}

/**
 * Render a single page to canvas with given scale
 */
async function renderPageToCanvas(page, scale) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    return canvas;
}

/**
 * Convert canvas to blob (image)
 */
function canvasToBlob(canvas, format, quality) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), `image/${format}`, quality);
    });
}

/**
 * Download a single image
 */
function downloadImage(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Download multiple images as ZIP
 */
async function downloadImagesAsZip(images, zipName) {
    // Load JSZip dynamically
    if (!window.JSZip) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    const JSZip = window.JSZip;
    const zip = new JSZip();
    
    for (const img of images) {
        zip.file(img.filename, img.blob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Main function - renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>🖼️ PDF to Image</h3>
            <p class="tool-description">Convert each page of a PDF to JPG or PNG images.</p>
            
            <div class="file-input-area">
                <input type="file" id="pdfToImageInput" accept=".pdf" />
                <label for="pdfToImageInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="image-config">
                <div class="config-row">
                    <label for="imageFormat">Format:</label>
                    <select id="imageFormat">
                        <option value="jpeg">JPEG (smaller size)</option>
                        <option value="png">PNG (higher quality)</option>
                    </select>
                </div>
                <div class="config-row">
                    <label for="imageQuality">Quality (JPEG only):</label>
                    <input type="range" id="imageQuality" min="0.1" max="1.0" step="0.05" value="0.92" />
                    <span id="qualityValue">92%</span>
                </div>
                <div class="config-row">
                    <label for="imageScale">Resolution (scale):</label>
                    <select id="imageScale">
                        <option value="0.5">Low (0.5x)</option>
                        <option value="0.75">Medium (0.75x)</option>
                        <option value="1.0" selected>Original (1.0x)</option>
                        <option value="1.5">High (1.5x)</option>
                        <option value="2.0">Very High (2.0x)</option>
                    </select>
                </div>
            </div>
            
            <button id="convertBtn" class="btn-primary" disabled>Convert to Images</button>
            <div id="convertStatus" class="status-message"></div>
            <div id="convertResult" class="convert-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#pdfToImageInput');
    const fileInfo = container.querySelector('#fileInfo');
    const formatSelect = container.querySelector('#imageFormat');
    const qualityRange = container.querySelector('#imageQuality');
    const qualityValue = container.querySelector('#qualityValue');
    const scaleSelect = container.querySelector('#imageScale');
    const convertBtn = container.querySelector('#convertBtn');
    const statusDiv = container.querySelector('#convertStatus');
    const resultDiv = container.querySelector('#convertResult');

    let selectedFile = null;
    let fileData = null;

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
            convertBtn.disabled = true;
            return;
        }

        selectedFile = files[0];
        fileInfo.innerHTML = `
            <div class="file-item">
                <span class="file-name">${selectedFile.name}</span>
                <span class="file-size">(${(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
        `;

        const buffer = await selectedFile.arrayBuffer();
        fileData = new Uint8Array(buffer);
        convertBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 5. Handle convert action
    convertBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        convertBtn.disabled = true;
        convertBtn.textContent = '⏳ Loading...';
        statusDiv.innerHTML = '⏳ Loading PDF.js library...';
        resultDiv.innerHTML = '';

        try {
            // Load PDF.js
            const pdfjs = await loadPdfJs();
            statusDiv.innerHTML = '📖 Reading PDF...';

            // Load PDF document
            const loadingTask = pdfjs.getDocument({ data: fileData });
            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages;

            if (totalPages === 0) {
                throw new Error('PDF has no pages.');
            }

            // Get settings
            const format = formatSelect.value;
            const quality = parseFloat(qualityRange.value);
            const scale = parseFloat(scaleSelect.value);

            statusDiv.innerHTML = `🔄 Rendering ${totalPages} pages... (scale: ${scale}x)`;

            // Render each page
            const images = [];
            for (let i = 1; i <= totalPages; i++) {
                const page = await pdf.getPage(i);
                const canvas = await renderPageToCanvas(page, scale);
                const blob = await canvasToBlob(canvas, format, quality);
                
                const pageNum = String(i).padStart(String(totalPages).length, '0');
                const filename = `${selectedFile.name.replace(/\.pdf$/i, '')}_page${pageNum}.${format}`;
                images.push({ blob, filename });
                
                // Update status every 5 pages
                if (i % 5 === 0 || i === totalPages) {
                    statusDiv.innerHTML = `🔄 Rendering ${i}/${totalPages} pages...`;
                }
            }

            statusDiv.innerHTML = `✅ Conversion completed! ${images.length} images created.`;

            // Show download options
            resultDiv.innerHTML = `
                <div class="result-actions">
                    <button id="downloadAllBtn" class="btn-primary">📦 Download All as ZIP</button>
                </div>
                <div class="image-list">
                    ${images.map((img, idx) => `
                        <div class="image-item">
                            <span>${img.filename}</span>
                            <button class="download-single-image" data-index="${idx}">⬇️ Download</button>
                        </div>
                    `).join('')}
                </div>
            `;

            // Download single image
            resultDiv.querySelectorAll('.download-single-image').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index);
                    const img = images[idx];
                    downloadImage(img.blob, img.filename);
                });
            });

            // Download all as ZIP
            resultDiv.querySelector('#downloadAllBtn').addEventListener('click', async () => {
                statusDiv.innerHTML = '⏳ Creating ZIP archive...';
                try {
                    const zipName = `${selectedFile.name.replace(/\.pdf$/i, '')}_images.zip`;
                    await downloadImagesAsZip(images, zipName);
                    statusDiv.innerHTML = '✅ ZIP downloaded!';
                } catch (err) {
                    statusDiv.innerHTML = `❌ ZIP error: ${err.message}`;
                }
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('PDF to Image error:', error);
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert to Images';
        }
    });
}