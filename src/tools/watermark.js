/**
 * Watermark Tool
 * Adds text or image watermark to all pages of a PDF
 * Supports position, opacity, rotation, and custom text/image
 * All processing happens client-side
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';
import {
    loadPdfLib,
    loadPdfDocument,
    savePdf
} from '../core/pdfUtils.js';

/**
 * Load an image from File object and return as ImageData
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
 * Convert Image to PNG Uint8Array (for watermark)
 */
function imageToPngBytes(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
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
            <h3>©️ Add Watermark</h3>
            <p class="tool-description">Add text or image watermark to all pages of a PDF.</p>
            
            <div class="file-input-area">
                <input type="file" id="watermarkFileInput" accept=".pdf" />
                <label for="watermarkFileInput" class="custom-file-label">Choose PDF file</label>
            </div>
            
            <div id="fileInfo" class="file-info"></div>
            
            <div class="watermark-config">
                <div class="config-section">
                    <label>Watermark type:</label>
                    <div class="radio-group">
                        <label><input type="radio" name="wmType" value="text" checked /> Text</label>
                        <label><input type="radio" name="wmType" value="image" /> Image</label>
                    </div>
                </div>
                
                <div id="textConfig" class="config-section">
                    <label for="wmText">Text:</label>
                    <input type="text" id="wmText" value="CONFIDENTIAL" />
                    
                    <label for="wmFontSize">Font size:</label>
                    <input type="number" id="wmFontSize" min="10" max="200" value="48" />
                    
                    <label for="wmColor">Color:</label>
                    <input type="color" id="wmColor" value="#ff0000" />
                </div>
                
                <div id="imageConfig" class="config-section" style="display:none;">
                    <label for="wmImage">Choose watermark image (PNG):</label>
                    <input type="file" id="wmImage" accept="image/png" />
                    <div id="imagePreview" class="image-preview"></div>
                </div>
                
                <div class="config-section">
                    <label for="wmOpacity">Opacity (0-1):</label>
                    <input type="range" id="wmOpacity" min="0.1" max="1.0" step="0.05" value="0.3" />
                    <span id="opacityValue">30%</span>
                    
                    <label for="wmRotation">Rotation (degrees):</label>
                    <input type="number" id="wmRotation" min="-180" max="180" value="-30" />
                    
                    <label for="wmPosition">Position:</label>
                    <select id="wmPosition">
                        <option value="center">Center</option>
                        <option value="topLeft">Top Left</option>
                        <option value="topRight">Top Right</option>
                        <option value="bottomLeft">Bottom Left</option>
                        <option value="bottomRight">Bottom Right</option>
                        <option value="custom">Custom (X,Y)</option>
                    </select>
                    
                    <div id="customPos" style="display:none;">
                        <label for="wmX">X (percentage of page):</label>
                        <input type="number" id="wmX" min="0" max="100" value="50" />
                        <label for="wmY">Y (percentage of page):</label>
                        <input type="number" id="wmY" min="0" max="100" value="50" />
                    </div>
                </div>
            </div>
            
            <button id="addWatermarkBtn" class="btn-primary" disabled>Add Watermark</button>
            <div id="wmStatus" class="status-message"></div>
            <div id="wmResult" class="wm-result"></div>
        </div>
    `;

    // 2. DOM references
    const fileInput = container.querySelector('#watermarkFileInput');
    const fileInfo = container.querySelector('#fileInfo');
    const wmTypeRadios = container.querySelectorAll('input[name="wmType"]');
    const textConfig = container.querySelector('#textConfig');
    const imageConfig = container.querySelector('#imageConfig');
    const wmText = container.querySelector('#wmText');
    const wmFontSize = container.querySelector('#wmFontSize');
    const wmColor = container.querySelector('#wmColor');
    const wmImageInput = container.querySelector('#wmImage');
    const imagePreview = container.querySelector('#imagePreview');
    const wmOpacity = container.querySelector('#wmOpacity');
    const opacityValue = container.querySelector('#opacityValue');
    const wmRotation = container.querySelector('#wmRotation');
    const wmPosition = container.querySelector('#wmPosition');
    const customPos = container.querySelector('#customPos');
    const wmX = container.querySelector('#wmX');
    const wmY = container.querySelector('#wmY');
    const addBtn = container.querySelector('#addWatermarkBtn');
    const statusDiv = container.querySelector('#wmStatus');
    const resultDiv = container.querySelector('#wmResult');

    let selectedFile = null;
    let fileData = null;
    let watermarkImageBytes = null;
    let watermarkImageDims = null;

    // 3. Show/Hide config based on watermark type
    wmTypeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.value === 'text') {
                textConfig.style.display = 'block';
                imageConfig.style.display = 'none';
            } else {
                textConfig.style.display = 'none';
                imageConfig.style.display = 'block';
            }
        });
    });

    // 4. Opacity display
    wmOpacity.addEventListener('input', () => {
        opacityValue.textContent = `${Math.round(parseFloat(wmOpacity.value) * 100)}%`;
    });

    // 5. Position toggle
    wmPosition.addEventListener('change', () => {
        customPos.style.display = wmPosition.value === 'custom' ? 'block' : 'none';
    });

    // 6. Handle watermark image upload
    wmImageInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            watermarkImageBytes = null;
            watermarkImageDims = null;
            imagePreview.innerHTML = '';
            return;
        }

        try {
            const img = await loadImageFromFile(file);
            watermarkImageDims = { width: img.width, height: img.height };
            watermarkImageBytes = imageToPngBytes(img);
            imagePreview.innerHTML = `
                <img src="${URL.createObjectURL(file)}" style="max-width:150px;max-height:100px;" />
                <span>${img.width}×${img.height}</span>
            `;
        } catch (err) {
            imagePreview.innerHTML = `❌ Error loading image: ${err.message}`;
        }
    });

    // 7. Handle file selection
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

    // 8. Handle add watermark action
    addBtn.addEventListener('click', async () => {
        if (!selectedFile || !fileData) {
            statusDiv.innerHTML = '⚠️ Please select a PDF file.';
            return;
        }

        const wmType = document.querySelector('input[name="wmType"]:checked').value;
        if (wmType === 'image' && !watermarkImageBytes) {
            statusDiv.innerHTML = '⚠️ Please select a watermark image (PNG).';
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
            const opacity = parseFloat(wmOpacity.value);
            const rotation = parseFloat(wmRotation.value) * (Math.PI / 180); // convert to radians
            const position = wmPosition.value;
            const customX = parseFloat(wmX.value) / 100;
            const customY = parseFloat(wmY.value) / 100;

            statusDiv.innerHTML = `🔄 Adding watermark to ${totalPages} pages...`;

            // Process each page
            for (let i = 0; i < totalPages; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();

                if (wmType === 'text') {
                    // Text watermark
                    const text = wmText.value || 'WATERMARK';
                    const fontSize = parseInt(wmFontSize.value) || 48;
                    const color = wmColor.value;

                    // Calculate position
                    const pos = calculatePosition(position, customX, customY, width, height, fontSize, 0);
                    
                    // Draw text with opacity using grayscale or RGB
                    const rgb = hexToRgb(color);
                    page.drawText(text, {
                        x: pos.x,
                        y: pos.y,
                        size: fontSize,
                        font: await pdfLib.StandardFonts.Helvetica,
                        color: pdfLib.rgb(rgb.r / 255, rgb.g / 255, rgb.b / 255),
                        opacity: opacity,
                        rotate: pdfLib.degrees(rotation * (180 / Math.PI))
                    });

                } else {
                    // Image watermark
                    const pngImage = await sourceDoc.embedPng(watermarkImageBytes);
                    const imgWidth = watermarkImageDims.width;
                    const imgHeight = watermarkImageDims.height;

                    // Scale image to fit within page (max 30% of page)
                    const maxWidth = width * 0.3;
                    const maxHeight = height * 0.3;
                    let scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
                    const drawWidth = imgWidth * scale;
                    const drawHeight = imgHeight * scale;

                    // Calculate position
                    const pos = calculatePosition(position, customX, customY, width, height, drawWidth, drawHeight);

                    page.drawImage(pngImage, {
                        x: pos.x,
                        y: pos.y,
                        width: drawWidth,
                        height: drawHeight,
                        opacity: opacity,
                        rotate: pdfLib.degrees(rotation * (180 / Math.PI))
                    });
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
            const outputName = `${baseName}_watermarked.pdf`;

            // Download
            downloadPdf(pdfBytes, outputName);

            statusDiv.innerHTML = `✅ Watermark added successfully! ${totalPages} pages.`;

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
            console.error('Watermark error:', error);
        } finally {
            addBtn.disabled = false;
            addBtn.textContent = 'Add Watermark';
        }
    });

    // Helper: calculate position based on option
    function calculatePosition(position, customX, customY, pageWidth, pageHeight, objWidth, objHeight) {
        let x = 0, y = 0;
        const margin = 20; // pixels margin from edges

        switch (position) {
            case 'center':
                x = (pageWidth - objWidth) / 2;
                y = (pageHeight - objHeight) / 2;
                break;
            case 'topLeft':
                x = margin;
                y = pageHeight - objHeight - margin;
                break;
            case 'topRight':
                x = pageWidth - objWidth - margin;
                y = pageHeight - objHeight - margin;
                break;
            case 'bottomLeft':
                x = margin;
                y = margin;
                break;
            case 'bottomRight':
                x = pageWidth - objWidth - margin;
                y = margin;
                break;
            case 'custom':
                x = (pageWidth - objWidth) * customX;
                y = (pageHeight - objHeight) * customY;
                break;
        }
        return { x, y };
    }

    // Helper: hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    }
}