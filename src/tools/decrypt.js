/**
 * PDF Decrypt Tool
 * Removes password protection from a PDF file
 * Requires the correct password
 * All processing happens client-side
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';
import {
    loadPdfLib,
    loadPdfDocument,
    savePdf
} from '../core/pdfUtils.js';

/**
 * Main function - renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>🔓 Decrypt PDF</h3>
            <p class="tool-description">Remove password protection from a PDF file.</p>
            
            <div class="file-input-area">
                <input type="file" id="decryptFileInput" accept=".pdf" />
                <label for="decryptFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="decrypt-config">
                <div class="config-row">
                    <label for="pdfPassword">Password:</label>
                    <input type="password" id="pdfPassword" placeholder="Enter PDF password" />
                </div>
            </div>
            
            <button id="decryptBtn" class="btn-primary" disabled>Decrypt PDF</button>
            <div id="decryptStatus" class="status-message"></div>
            <div id="decryptResult" class="decrypt-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#decryptFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const pdfPassword = container.querySelector('#pdfPassword');
    const decryptBtn = container.querySelector('#decryptBtn');
    const statusDiv = container.querySelector('#decryptStatus');
    const resultDiv = container.querySelector('#decryptResult');

    let selectedFile = null;
    let fileData = null;

    // 3. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            decryptBtn.disabled = true;
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
        decryptBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 4. Handle decrypt action
    decryptBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        const password = pdfPassword.value.trim();
        if (!password) {
            statusDiv.innerHTML = '⚠️ Please enter the PDF password.';
            return;
        }

        decryptBtn.disabled = true;
        decryptBtn.textContent = '⏳ Decrypting...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            
            // Try to load PDF with password
            let sourceDoc;
            try {
                sourceDoc = await loadPdfDocument(pdfLib, fileData, { password });
            } catch (err) {
                if (err.message && err.message.includes('password')) {
                    throw new Error('Incorrect password. Please try again.');
                }
                throw err;
            }

            // Check if document is actually encrypted
            // If it loaded, we can save it without encryption
            // But pdf-lib doesn't have a direct "remove encryption" method
            // So we need to create a new document and copy all pages

            statusDiv.innerHTML = '🔄 Recreating document without encryption...';

            // Create a new document (unencrypted)
            const newDoc = await pdfLib.PDFDocument.create();
            const pages = sourceDoc.getPages();
            
            // Copy all pages from source to new document
            for (let i = 0; i < pages.length; i++) {
                const [copiedPage] = await newDoc.copyPages(sourceDoc, [i]);
                newDoc.addPage(copiedPage);
            }

            // Save unencrypted PDF
            statusDiv.innerHTML = '💾 Saving decrypted PDF...';
            const pdfBytes = await newDoc.save();

            // Generate filename
            const baseName = selectedFile.name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_decrypted.pdf`;

            // Download
            downloadPdf(pdfBytes, outputName);

            statusDiv.innerHTML = `✅ PDF decrypted successfully! Password removed.`;
            statusDiv.style.color = '#28a745';

            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>📄 ${outputName}</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
                <div class="info">
                    ✅ Password removed. This PDF is now unprotected.
                </div>
            `;

            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(pdfBytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            statusDiv.style.color = '#dc3545';
            console.error('Decrypt error:', error);
        } finally {
            decryptBtn.disabled = false;
            decryptBtn.textContent = 'Decrypt PDF';
        }
    });
}