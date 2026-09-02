/**
 * Image to PDF Tool
 * Converts multiple images (JPG, PNG, etc.) into a single PDF file
 * Each image becomes a separate page
 * All processing happens client-side
 */

import { downloadPdf } from '../core/fileHandler.js';
import { loadPdfLib, createNewPdf, savePdf } from '../core/pdfUtils.js';

/**
 * Load an image from File object and return as HTMLImageElement
 */
function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Convert Image to JPEG Uint8Array using Canvas
 */
function imageToJpeg(image, quality = 0.92) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
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
            <h3>🖼️ Image to PDF</h3>
            <p class="tool-description">Convert multiple images (JPG, PNG, etc.) into a single PDF file.</p>
            
            <div class="file-input-area">
                <input type="file" id="imageToPdfInput" accept="image/*" multiple />
                <label for="imageToPdfInput" class="custom-file-label">Choose Images</label>
            </div>
            
            <div id="fileList" class="file-list"></div>
            
            <div class="pdf-config">
                <div class="config-row">
                    <label for="pageSize">Page size:</label>
                    <select id="pageSize">
                        <option value="auto">Auto (fit image)</option>
                        <option value="a4">A4 (210x297mm)</option>
                        <option value="letter">Letter (8.5x11in)</option>
                        <option value="a5">A5 (148x210mm)</option>
                    </select>
                </div>
                <div class="config-row">
                    <label for="imageQuality">Image quality (JPEG):</label>
                    <input type="range" id="imageQuality" min="0.1" max="1.0" step="0.05" value="0.92" />
                    <span id="qualityValue">92%</span>
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="fitToPage" checked />
                        Fit image to page (maintain aspect ratio)
                    </label>
                </div>
            </div>
            
            <button id="convertToPdfBtn" class="btn-primary" disabled>Convert to PDF</button>
            <div id="convertStatus" class="status-message"></div>
            <div id="convertResult" class="convert-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#imageToPdfInput');
    const fileListDiv = container.querySelector('#fileList');
    const pageSizeSelect = container.querySelector('#pageSize');
    const qualityRange = container.querySelector('#imageQuality');
    const qualityValue = container.querySelector('#qualityValue');
    const fitToPageCheck = container.querySelector('#fitToPage');
    const convertBtn = container.querySelector('#convertToPdfBtn');
    const statusDiv = container.querySelector('#convertStatus');
    const resultDiv = container.querySelector('#convertResult');

    // 3. State: array of File objects
    let selectedFiles = [];

    // 4. Quality slider display
    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = `${Math.round(parseFloat(qualityRange.value) * 100)}%`;
    });

    // 5. Helper: update file list UI and button state
    function updateFileList() {
        if (selectedFiles.length === 0) {
            fileListDiv.innerHTML = '';
            convertBtn.disabled = true;
            return;
        }

        fileListDiv.innerHTML = selectedFiles.map((file, index) => `
            <div class="file-item" data-index="${index}">
                <span class="file-index">${index + 1}.</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${(file.size / 1024).toFixed(1)} KB)</span>
                <span class="file-type">${file.type}</span>
                <button class="remove-file-btn" data-index="${index}">✖ Remove</button>
            </div>
        `).join('');

        // Attach remove event listeners
        fileListDiv.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                removeFile(idx);
            });
        });

        convertBtn.disabled = selectedFiles.length === 0;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    }

    // 6. Helper: remove a file by index
    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        fileInput.value = ''; // reset so user can re-select same file
    }

    // 7. Helper: add new files (avoid duplicates by name + size)
    function addFiles(newFiles) {
        const existingKeys = new Set(selectedFiles.map(f => f.name + f.size));
        const uniqueNewFiles = [];
        for (const file of newFiles) {
            const key = file.name + file.size;
            if (!existingKeys.has(key)) {
                uniqueNewFiles.push(file);
                existingKeys.add(key);
            }
        }
        if (uniqueNewFiles.length === 0) {
            statusDiv.innerHTML = '⚠️ All selected images are already in the list.';
            return;
        }
        selectedFiles = [...selectedFiles, ...uniqueNewFiles];
        updateFileList();
        fileInput.value = ''; // reset input
        statusDiv.innerHTML = '';
    }

    // 8. Handle file selection (add, not replace)
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        addFiles(files);
    });

    // 9. Handle convert action
    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            statusDiv.innerHTML = '⚠️ Please select at least one image.';
            return;
        }

        convertBtn.disabled = true;
        convertBtn.textContent = '⏳ Loading...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            const quality = parseFloat(qualityRange.value);
            const pageSize = pageSizeSelect.value;
            const fitToPage = fitToPageCheck.checked;

            const pdfDoc = await createNewPdf(pdfLib);
            statusDiv.innerHTML = `📖 Processing ${selectedFiles.length} images...`;

            const pageSizes = {
                a4: { width: 595.28, height: 841.89 },
                letter: { width: 612, height: 792 },
                a5: { width: 419.53, height: 595.28 }
            };

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                statusDiv.innerHTML = `🔄 Loading image ${i + 1}/${selectedFiles.length}...`;
                const img = await loadImageFromFile(file);

                statusDiv.innerHTML = `🔄 Converting image ${i + 1}/${selectedFiles.length}...`;
                const imageBytes = imageToJpeg(img, quality);
                const jpegImage = await pdfDoc.embedJpg(imageBytes);

                let pageWidth, pageHeight;
                if (pageSize === 'auto') {
                    pageWidth = img.width;
                    pageHeight = img.height;
                } else {
                    const size = pageSizes[pageSize];
                    pageWidth = size.width;
                    pageHeight = size.height;
                }

                const page = pdfDoc.addPage([pageWidth, pageHeight]);
                const imgWidth = jpegImage.width;
                const imgHeight = jpegImage.height;

                let x, y, width, height;
                if (fitToPage) {
                    const pageAspect = pageWidth / pageHeight;
                    const imgAspect = imgWidth / imgHeight;
                    if (imgAspect > pageAspect) {
                        width = pageWidth;
                        height = pageWidth / imgAspect;
                        x = 0;
                        y = (pageHeight - height) / 2;
                    } else {
                        height = pageHeight;
                        width = pageHeight * imgAspect;
                        x = (pageWidth - width) / 2;
                        y = 0;
                    }
                } else {
                    width = Math.min(imgWidth, pageWidth);
                    height = Math.min(imgHeight, pageHeight);
                    x = 0;
                    y = pageHeight - height;
                }

                page.drawImage(jpegImage, { x, y, width, height });

                if ((i + 1) % 5 === 0 || i + 1 === selectedFiles.length) {
                    statusDiv.innerHTML = `🔄 Processed ${i + 1}/${selectedFiles.length} images...`;
                }
            }

            statusDiv.innerHTML = '💾 Saving PDF...';
            const pdfBytes = await savePdf(pdfDoc);

            const baseName = selectedFiles[0].name.replace(/\.[^.]+$/, '');
            const outputName = `${baseName}_converted.pdf`;
            downloadPdf(pdfBytes, outputName);

            statusDiv.innerHTML = `✅ PDF created successfully! ${selectedFiles.length} pages.`;
            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>📄 ${outputName} (${selectedFiles.length} pages)</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
            `;
            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(pdfBytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('Image to PDF error:', error);
        } finally {
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert to PDF';
            // Re-enable/disable based on file count
            convertBtn.disabled = selectedFiles.length === 0;
        }
    });

    // 10. Initial UI update
    updateFileList();
}