/**
 * Page Number Tool
 * Adds page numbers to all pages of a PDF
 * Supports custom format, position, font size, and color
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
            <h3>🔢 Add Page Numbers</h3>
            <p class="tool-description">Add page numbers to all pages of a PDF.</p>
            
            <div class="file-input-area">
                <input type="file" id="pageNumFileInput" accept=".pdf" />
                <label for="pageNumFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="page-num-config">
                <div class="config-row">
                    <label for="numFormat">Format:</label>
                    <select id="numFormat">
                        <option value="simple">1, 2, 3...</option>
                        <option value="pageOf">Page 1 of 10</option>
                        <option value="fraction">1/10</option>
                        <option value="custom">Custom template</option>
                    </select>
                </div>
                <div id="customTemplateGroup" style="display:none;">
                    <label for="customTemplate">Template (use {page} and {total}):</label>
                    <input type="text" id="customTemplate" value="Page {page} of {total}" />
                </div>
                <div class="config-row">
                    <label for="numPosition">Position:</label>
                    <select id="numPosition">
                        <option value="bottomCenter">Bottom Center</option>
                        <option value="bottomRight">Bottom Right</option>
                        <option value="bottomLeft">Bottom Left</option>
                        <option value="topCenter">Top Center</option>
                        <option value="topRight">Top Right</option>
                        <option value="topLeft">Top Left</option>
                    </select>
                </div>
                <div class="config-row">
                    <label for="numFontSize">Font size:</label>
                    <input type="number" id="numFontSize" min="6" max="72" value="12" />
                </div>
                <div class="config-row">
                    <label for="numColor">Color:</label>
                    <input type="color" id="numColor" value="#000000" />
                </div>
                <div class="config-row">
                    <label for="numMargin">Margin from edge (px):</label>
                    <input type="number" id="numMargin" min="0" max="200" value="30" />
                </div>
                <div class="config-row">
                    <label for="startNumber">Start from page:</label>
                    <input type="number" id="startNumber" min="1" value="1" />
                </div>
                <div class="config-row">
                    <label>
                        <input type="checkbox" id="skipFirstPage" />
                        Skip first page (title page)
                    </label>
                </div>
            </div>
            
            <button id="addPageNumBtn" class="btn-primary" disabled>Add Page Numbers</button>
            <div id="pnStatus" class="status-message"></div>
            <div id="pnResult" class="pn-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#pageNumFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const numFormat = container.querySelector('#numFormat');
    const customTemplateGroup = container.querySelector('#customTemplateGroup');
    const customTemplate = container.querySelector('#customTemplate');
    const numPosition = container.querySelector('#numPosition');
    const numFontSize = container.querySelector('#numFontSize');
    const numColor = container.querySelector('#numColor');
    const numMargin = container.querySelector('#numMargin');
    const startNumber = container.querySelector('#startNumber');
    const skipFirstPage = container.querySelector('#skipFirstPage');
    const addBtn = container.querySelector('#addPageNumBtn');
    const statusDiv = container.querySelector('#pnStatus');
    const resultDiv = container.querySelector('#pnResult');

    let selectedFile = null;
    let fileData = null;

    // 3. Show/hide custom template input
    numFormat.addEventListener('change', () => {
        customTemplateGroup.style.display = numFormat.value === 'custom' ? 'block' : 'none';
    });

    // 4. Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length === 0) {
            selectedFile = null;
            fileData = null;
            fileInfo.innerHTML = '';
            addBtn.disabled = true;
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
        addBtn.disabled = false;
        statusDiv.innerHTML = '';
        resultDiv.innerHTML = '';
    });

    // 5. Handle add page numbers action
    addBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        addBtn.disabled = true;
        addBtn.textContent = '⏳ Processing...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';
        resultDiv.innerHTML = '';

        try {
            const pdfLib = await loadPdfLib();
            const sourceDoc = await loadPdfDocument(pdfLib, fileData);
            const pages = sourceDoc.getPages();
            const totalPages = pages.length;

            if (totalPages === 0) {
                throw new Error('PDF has no pages.');
            }

            // Get settings
            const format = numFormat.value;
            let template = '';
            if (format === 'simple') template = '{page}';
            else if (format === 'pageOf') template = 'Page {page} of {total}';
            else if (format === 'fraction') template = '{page}/{total}';
            else if (format === 'custom') template = customTemplate.value || 'Page {page}';

            const position = numPosition.value;
            const fontSize = parseInt(numFontSize.value) || 12;
            const color = numColor.value;
            const margin = parseInt(numMargin.value) || 30;
            const startFrom = parseInt(startNumber.value) || 1;
            const skipFirst = skipFirstPage.checked;

            // Convert hex to RGB
            const rgb = hexToRgb(color);

            // Load standard font
            const font = await pdfLib.StandardFonts.Helvetica;

            statusDiv.innerHTML = `🔄 Adding page numbers to ${totalPages} pages...`;

            let pageNum = startFrom;
            for (let i = 0; i < totalPages; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                // Determine if we should skip numbering this page
                const shouldSkip = (i === 0 && skipFirst);
                const displayNumber = shouldSkip ? '' : pageNum;

                // Generate text
                let text = '';
                if (!shouldSkip) {
                    text = template
                        .replace(/{page}/g, displayNumber)
                        .replace(/{total}/g, totalPages - (skipFirst ? 1 : 0));
                }

                // Calculate position based on alignment
                const textWidth = text ? font.widthOfTextAtSize(text, fontSize) : 0;
                const textHeight = fontSize;

                let x = 0, y = 0;
                const pos = position.toLowerCase();

                if (pos.includes('top')) {
                    y = height - margin - textHeight;
                } else {
                    y = margin;
                }

                if (pos.includes('left')) {
                    x = margin;
                } else if (pos.includes('right')) {
                    x = width - margin - textWidth;
                } else {
                    x = (width - textWidth) / 2;
                }

                // Draw text if not skipped
                if (!shouldSkip && text) {
                    page.drawText(text, {
                        x: x,
                        y: y,
                        size: fontSize,
                        font: font,
                        color: pdfLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255)
                    });
                    pageNum++;
                }

                // Update progress
                if ((i + 1) % 10 === 0 || i + 1 === totalPages) {
                    statusDiv.innerHTML = `🔄 Processed ${i + 1}/${totalPages} pages...`;
                }
            }

            // Save PDF
            statusDiv.innerHTML = '💾 Saving PDF...';
            const pdfBytes = await savePdf(sourceDoc);

            // Generate filename
            const baseName = selectedFile.name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_numbered.pdf`;

            // Download
            downloadPdf(pdfBytes, outputName);

            statusDiv.innerHTML = `✅ Page numbers added successfully! ${totalPages} pages.`;

            resultDiv.innerHTML = `
                <div class="result-item">
                    <span>📄 ${outputName}</span>
                    <button class="download-again-btn">⬇️ Download Again</button>
                </div>
            `;

            resultDiv.querySelector('.download-again-btn').addEventListener('click', () => {
                downloadPdf(pdfBytes, outputName);
            });

        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('Page Number error:', error);
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = 'Add Page Numbers';
        }
    });

    // Helper: hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
}