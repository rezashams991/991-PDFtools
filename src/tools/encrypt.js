/**
 * PDF Encrypt Tool
 * Adds password protection to a PDF file
 * Uses AES-128 encryption (standard PDF encryption)
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
            <h3>🔒 Encrypt PDF</h3>
            <p class="tool-description">Add password protection to a PDF file.</p>
            
            <div class="file-input-area">
                <input type="file" id="encryptFileInput" accept=".pdf" />
                <label for="encryptFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="encrypt-config">
                <div class="config-row">
                    <label for="userPassword">User password (to open):</label>
                    <input type="password" id="userPassword" placeholder="Enter password" />
                </div>
                <div class="config-row">
                    <label for="ownerPassword">Owner password (to edit):</label>
                    <input type="password" id="ownerPassword" placeholder="Enter owner password (optional)" />
                    <small>If set, user can only view, owner can modify</small>
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="allowPrint" checked />
                        Allow printing
                    </label>
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="allowCopy" checked />
                        Allow copying text
                    </label>
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="allowModify" checked />
                        Allow modifying
                    </label>
                </div>
            </div>
            
            <button id="encryptBtn" class="btn-primary" disabled>Encrypt PDF</button>
            <div id="encryptStatus" class="status-message"></div>
            <div id="encryptResult" class="encrypt-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#encryptFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const userPassword = container.querySelector('#userPassword');
    const ownerPassword = container.querySelector('#ownerPassword');
    const allowPrint = container.querySelector('#allowPrint');
    const allowCopy = container.querySelector('#allowCopy');
    const allowModify = container.querySelector('#allowModify');
    const encryptBtn = container.querySelector('#encryptBtn');
    const statusDiv = container.querySelector('#encryptStatus');
    const resultDiv = container.querySelector('#encryptResult');

    let selectedFile = null;
    let fileData = null;

    // 3. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            encryptBtn.disabled = true;
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
        encryptBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 4. Handle encrypt action
    encryptBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        const userPass = userPassword.value.trim();
        if (!userPass) {
            statusDiv.innerHTML = '⚠️ Please enter a user password.';
            return;
        }

        if (userPass.length < 4) {
            statusDiv.innerHTML = '⚠️ Password must be at least 4 characters.';
            return;
        }

        encryptBtn.disabled = true;
        encryptBtn.textContent = '⏳ Encrypting...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            const sourceDoc = await loadPdfDocument(pdfLib, fileData);

            // Set permissions
            const permissions = {
                printing: allowPrint.checked ? 'highResolution' : 'none',
                modifying: allowModify.checked,
                copying: allowCopy.checked
            };

            // Encrypt the document
            const ownerPass = ownerPassword.value.trim() || userPass;
            sourceDoc.encrypt({
                userPassword: userPass,
                ownerPassword: ownerPass,
                permissions: {
                    printing: permissions.printing,
                    modifying: permissions.modifying,
                    copying: permissions.copying
                }
            });

            // Save PDF
            statusDiv.innerHTML = '💾 Saving encrypted PDF...';
            const pdfBytes = await savePdf(sourceDoc);

            // Generate filename
            const baseName = selectedFile.name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_encrypted.pdf`;

            // Download
            downloadPdf(pdfBytes, outputName);

            statusDiv.innerHTML = `✅ PDF encrypted successfully! Password: "${userPass}"`;
            statusDiv.style.color = '#28a745';

            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>🔒 ${outputName}</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
                <div class="password-info">
                    <strong>Password:</strong> <code>${userPass}</code>
                    <br /><small>Keep this password safe!</small>
                </div>
            `;

            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(pdfBytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            statusDiv.style.color = '#dc3545';
            console.error('Encrypt error:', error);
        } finally {
            encryptBtn.disabled = false;
            encryptBtn.textContent = 'Encrypt PDF';
        }
    });
}