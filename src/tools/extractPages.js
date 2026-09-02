/**
 * Extract Pages Tool
 * Extracts specific pages from a PDF and creates a new PDF
 * User can enter page numbers or ranges (e.g., 1,3,5-7,9)
 * All processing happens client-side
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';
import {
    loadPdfLib,
    loadPdfDocument,
    createNewPdf,
    copyPagesByIndex,
    savePdf
} from '../core/pdfUtils.js';

/**
 * Parse page input like "1,3,5-7,9" into array of 0-based indices
 */
function parsePageInput(input, totalPages) {
    if (!input || input.trim() === '') {
        throw new Error('Please enter at least one page or range.');
    }

    const parts = input.split(',').map(s => s.trim());
    const indices = [];

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                throw new Error(`Invalid range: ${part}. Pages are 1 to ${totalPages}.`);
            }
            for (let i = start; i <= end; i++) {
                indices.push(i - 1); // 0-based
            }
        } else {
            const page = Number(part);
            if (isNaN(page) || page < 1 || page > totalPages) {
                throw new Error(`Invalid page: ${part}. Pages are 1 to ${totalPages}.`);
            }
            indices.push(page - 1);
        }
    }

    // Remove duplicates and sort
    const unique = [...new Set(indices)].sort((a, b) => a - b);
    return unique;
}

/**
 * Main function - renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>📑 Extract Pages</h3>
            <p class="tool-description">Extract specific pages from a PDF and create a new file.</p>
            
            <div class="file-input-area">
                <input type="file" id="extractFileInput" accept=".pdf" />
                <label for="extractFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="extract-config">
                <label for="pageInput">Enter pages or ranges (comma separated):</label>
                <input type="text" id="pageInput" placeholder="e.g., 1,3,5-7,9" value="1,3-5" />
                <small>Example: 1,3,5-7,9 → pages 1, 3, 5, 6, 7, 9</small>
            </div>
            
            <button id="extractBtn" class="btn-primary" disabled>Extract Pages</button>
            <div id="extractStatus" class="status-message"></div>
            <div id="extractResult" class="extract-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#extractFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const pageInput = container.querySelector('#pageInput');
    const extractBtn = container.querySelector('#extractBtn');
    const statusDiv = container.querySelector('#extractStatus');
    const resultDiv = container.querySelector('#extractResult');

    let selectedFile = null;
    let fileData = null;

    // 3. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            extractBtn.disabled = true;
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
        extractBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 4. Handle extract action
    extractBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        const input = pageInput.value.trim();
        if (!input) {
            statusDiv.innerHTML = '⚠️ Please enter pages or ranges.';
            return;
        }

        extractBtn.disabled = true;
        extractBtn.textContent = '⏳ Extracting...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            const sourceDoc = await loadPdfDocument(pdfLib, fileData);
            const totalPages = sourceDoc.getPageCount();

            if (totalPages === 0) {
                throw new Error('PDF has no pages.');
            }

            // Parse user input
            const pageIndices = parsePageInput(input, totalPages);
            if (pageIndices.length === 0) {
                throw new Error('No valid pages found.');
            }

            statusDiv.innerHTML = `🔄 Extracting ${pageIndices.length} pages...`;

            // Create new document and copy selected pages
            const newDoc = await createNewPdf(pdfLib);
            await copyPagesByIndex(sourceDoc, newDoc, pageIndices);
            const bytes = await savePdf(newDoc);

            // Generate output filename
            const baseName = selectedFile.name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_extracted_${pageIndices.length}pages.pdf`;

            // Download directly
            downloadPdf(bytes, outputName);

            statusDiv.innerHTML = `✅ Extraction completed! ${pageIndices.length} pages extracted.`;

            // Show result info
            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>📄 ${outputName} (${pageIndices.length} pages)</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
            `;

            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(bytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('Extract error:', error);
        } finally {
            extractBtn.disabled = false;
            extractBtn.textContent = 'Extract Pages';
        }
    });
}