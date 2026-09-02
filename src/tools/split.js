/**
 * PDF Split Tool
 * Splits a PDF into multiple files based on:
 * - Page ranges (e.g., 1-5, 6-10)
 * - Every N pages
 * - Odd/Even pages
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
 * Main function - renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>✂️ Split PDF</h3>
            <p class="tool-description">Split a PDF into multiple files.</p>
            
            <div class="file-input-area">
                <input type="file" id="splitFileInput" accept=".pdf" />
                <label for="splitFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="split-options">
                <label>Split method:</label>
                <select id="splitMethod">
                    <option value="ranges">Page ranges (e.g., 1-5, 6-10)</option>
                    <option value="everyN">Every N pages</option>
                    <option value="oddEven">Odd / Even pages</option>
                </select>
            </div>
            
            <div id="splitConfig" class="split-config">
                <label for="rangeInput">Enter ranges (comma separated):</label>
                <input type="text" id="rangeInput" placeholder="1-5, 6-10, 11-15" value="1-3, 4-6" />
            </div>
            
            <button id="splitBtn" class="btn-primary" disabled>Split PDF</button>
            <div id="splitStatus" class="status-message"></div>
            <div id="splitResult" class="split-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#splitFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const splitMethod = container.querySelector('#splitMethod');
    const splitConfig = container.querySelector('#splitConfig');
    const rangeInput = container.querySelector('#rangeInput');
    const splitBtn = container.querySelector('#splitBtn');
    const statusDiv = container.querySelector('#splitStatus');
    const resultDiv = container.querySelector('#splitResult');

    let selectedFile = null;
    let fileData = null; // Store Uint8Array

    // 3. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            splitBtn.disabled = true;
            return;
        }

        selectedFile = files[0];
        fileInfo.innerHTML = `
            <div class="file-item">
                <span class="file-name">${selectedFile.name}</span>
                <span class="file-size">(${(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
        `;

        // Read file data for processing later
        const buffer = await selectedFile.arrayBuffer();
        fileData = new Uint8Array(buffer);
        splitBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 4. Handle split method change
    splitMethod.addEventListener('change', () => {
        const method = splitMethod.value;
        if (method === 'ranges') {
            splitConfig.innerHTML = `
                <label for="rangeInput">Enter ranges (comma separated):</label>
                <input type="text" id="rangeInput" placeholder="1-5, 6-10, 11-15" value="1-3, 4-6" />
            `;
        } else if (method === 'everyN') {
            splitConfig.innerHTML = `
                <label for="everyNInput">Pages per split:</label>
                <input type="number" id="everyNInput" min="1" value="2" />
            `;
        } else if (method === 'oddEven') {
            splitConfig.innerHTML = `
                <p>Split into two files: Odd pages and Even pages</p>
            `;
        }
        resultDiv.innerHTML = '';
    });

    // 5. Handle split action
    splitBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        splitBtn.disabled = true;
        splitBtn.textContent = '⏳ Splitting...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            const sourceDoc = await loadPdfDocument(pdfLib, fileData);
            const totalPages = sourceDoc.getPageCount();

            if (totalPages === 0) {
                throw new Error('PDF has no pages.');
            }

            const method = splitMethod.value;
            let pageGroups = [];

            if (method === 'ranges') {
                // Parse ranges: "1-3, 5-7, 9"
                const rangeInputEl = splitConfig.querySelector('#rangeInput');
                const raw = rangeInputEl.value.trim();
                if (!raw) throw new Error('Please enter at least one range.');

                const parts = raw.split(',').map(s => s.trim());
                for (const part of parts) {
                    if (part.includes('-')) {
                        const [start, end] = part.split('-').map(Number);
                        if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages || start > end) {
                            throw new Error(`Invalid range: ${part}. Pages are 1 to ${totalPages}.`);
                        }
                        const indices = [];
                        for (let i = start; i <= end; i++) indices.push(i - 1); // 0-based
                        pageGroups.push(indices);
                    } else {
                        const page = Number(part);
                        if (isNaN(page) || page < 1 || page > totalPages) {
                            throw new Error(`Invalid page: ${part}. Pages are 1 to ${totalPages}.`);
                        }
                        pageGroups.push([page - 1]);
                    }
                }

            } else if (method === 'everyN') {
                const everyNInput = splitConfig.querySelector('#everyNInput');
                const n = parseInt(everyNInput.value);
                if (isNaN(n) || n < 1) throw new Error('Please enter a valid number (>= 1).');

                for (let start = 0; start < totalPages; start += n) {
                    const end = Math.min(start + n, totalPages);
                    const indices = [];
                    for (let i = start; i < end; i++) indices.push(i);
                    pageGroups.push(indices);
                }

            } else if (method === 'oddEven') {
                const oddPages = [];
                const evenPages = [];
                for (let i = 0; i < totalPages; i++) {
                    if ((i + 1) % 2 === 1) oddPages.push(i);
                    else evenPages.push(i);
                }
                if (oddPages.length > 0) pageGroups.push(oddPages);
                if (evenPages.length > 0) pageGroups.push(evenPages);
            }

            if (pageGroups.length === 0) {
                throw new Error('No page groups generated.');
            }

            statusDiv.innerHTML = `🔄 Creating ${pageGroups.length} split files...`;

            // Generate split files
            const outputFiles = [];
            for (let idx = 0; idx < pageGroups.length; idx++) {
                const indices = pageGroups[idx];
                const newDoc = await createNewPdf(pdfLib);
                await copyPagesByIndex(sourceDoc, newDoc, indices);
                const bytes = await savePdf(newDoc);

                let filename = selectedFile.name.replace(/\.pdf$/i, '');
                if (method === 'ranges') {
                    const rangeStr = indices.map(i => i + 1).join('-');
                    filename += `_part${idx+1}_${rangeStr}.pdf`;
                } else if (method === 'everyN') {
                    const start = indices[0] + 1;
                    const end = indices[indices.length - 1] + 1;
                    filename += `_part${idx+1}_${start}-${end}.pdf`;
                } else if (method === 'oddEven') {
                    const type = (indices[0] + 1) % 2 === 1 ? 'odd' : 'even';
                    filename += `_${type}.pdf`;
                }
                outputFiles.push({ data: bytes, name: filename });
            }

            statusDiv.innerHTML = `✅ Split completed! ${outputFiles.length} files created.`;

            // Show download links for each file
            resultDiv.innerHTML = outputFiles.map((file, idx) => `
                <div class="result-item">
                    <span>${file.name}</span>
                    <button class="download-single-btn" data-index="${idx}">⬇️ Download</button>
                </div>
            `).join('');

            // Add download listeners
            resultDiv.querySelectorAll('.download-single-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.index);
                    const file = outputFiles[idx];
                    downloadPdf(file.data, file.name);
                });
            });

            // Also add a "Download All" button
            const downloadAllBtn = document.createElement('button');
            downloadAllBtn.className = 'btn-secondary';
            downloadAllBtn.textContent = '📦 Download All (as ZIP)';
            downloadAllBtn.style.marginTop = '10px';
            downloadAllBtn.addEventListener('click', async () => {
                statusDiv.innerHTML = '⏳ Creating ZIP archive...';
                try {
                    // Use JSZip from CDN
                    const JSZip = await loadJSZip();
                    const zip = new JSZip();
                    for (const file of outputFiles) {
                        zip.file(file.name, file.data);
                    }
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const url = URL.createObjectURL(zipBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedFile.name.replace(/\.pdf$/i, '')}_split.zip`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    statusDiv.innerHTML = '✅ ZIP downloaded!';
                } catch (err) {
                    statusDiv.innerHTML = `❌ ZIP error: ${err.message}`;
                }
            });
            resultDiv.appendChild(downloadAllBtn);

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('Split error:', error);
        } finally {
            splitBtn.disabled = false;
            splitBtn.textContent = 'Split PDF';
        }
    });

    // Helper to load JSZip
    async function loadJSZip() {
        if (window.JSZip) return window.JSZip;
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return window.JSZip;
    }
}