/**
 * PDF Merge Tool
 * Merges multiple PDF files into a single PDF
 * All processing happens client-side (browser)
 */

import { readFilesAsBuffers, downloadPdf } from '../core/fileHandler.js';
import { 
    loadPdfLib, 
    createNewPdf, 
    loadPdfDocument, 
    copyAllPages, 
    savePdf 
} from '../core/pdfUtils.js';

/**
 * Main function - receives a DOM container and renders the tool UI
 */
export default async function run(container) {
    // 1. Render UI
    container.innerHTML = `
        <div class="pdf-tool-wrapper">
            <h3>📄 Merge PDF Files</h3>
            <p class="tool-description">Select multiple PDF files and merge them into one.</p>
            
            <div class="file-input-area">
                <input type="file" id="mergeFileInput" accept=".pdf" multiple />
                <label for="mergeFileInput" class="custom-file-label">Choose PDF files</label>
            </div>
            
            <div id="fileList" class="file-list"></div>
            
            <button id="mergeBtn" class="btn-primary" disabled>Merge Files</button>
            <div id="mergeStatus" class="status-message"></div>
        </div>
    `;

    // 2. Get DOM references
    const fileInput = container.querySelector('#mergeFileInput');
    const fileListDiv = container.querySelector('#fileList');
    const mergeBtn = container.querySelector('#mergeBtn');
    const statusDiv = container.querySelector('#mergeStatus');

    // 3. Track selected files (as File objects)
    let selectedFiles = [];

    // 4. Helper: update UI and button state
    function updateFileList() {
        if (selectedFiles.length === 0) {
            fileListDiv.innerHTML = '';
            mergeBtn.disabled = true;
            return;
        }

        fileListDiv.innerHTML = selectedFiles.map((file, index) => `
            <div class="file-item" data-index="${index}">
                <span class="file-index">${index + 1}.</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${(file.size / 1024).toFixed(1)} KB)</span>
                <button class="remove-file-btn" data-index="${index}">✖ Remove</button>
            </div>
        `).join('');

        // Attach remove event listeners
        fileListDiv.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index);
                removeFile(idx);
            });
        });

        // Enable merge button if at least 2 files selected
        mergeBtn.disabled = selectedFiles.length < 2;
        statusDiv.innerHTML = '';
    }

    // 5. Helper: remove a file by index
    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
        // Reset input value so user can re-select the same file if needed
        fileInput.value = '';
    }

    // 6. Helper: add new files (avoid duplicates)
    function addFiles(newFiles) {
        // Filter out duplicates (based on name + size)
        const existingNames = new Set(selectedFiles.map(f => f.name + f.size));
        const uniqueNewFiles = [];
        for (const file of newFiles) {
            const key = file.name + file.size;
            if (!existingNames.has(key)) {
                uniqueNewFiles.push(file);
                existingNames.add(key);
            }
        }
        if (uniqueNewFiles.length === 0) {
            statusDiv.innerHTML = '⚠️ All selected files are already in the list.';
            return;
        }
        selectedFiles = [...selectedFiles, ...uniqueNewFiles];
        updateFileList();
        // Reset input so user can select more files
        fileInput.value = '';
        statusDiv.innerHTML = '';
    }

    // 7. Handle file selection (add, not replace)
    fileInput.addEventListener('change', (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        addFiles(files);
    });

    // 8. Handle merge action
    mergeBtn.addEventListener('click', async () => {
        if (selectedFiles.length < 2) {
            statusDiv.innerHTML = '⚠️ Please select at least 2 PDF files.';
            return;
        }

        mergeBtn.disabled = true;
        mergeBtn.textContent = '⏳ Merging...';
        statusDiv.innerHTML = '⏳ Loading PDF library...';

        try {
            const pdfLib = await loadPdfLib();
            statusDiv.innerHTML = '📖 Reading files...';

            const fileBuffers = await readFilesAsBuffers(selectedFiles);
            const mergedPdf = await createNewPdf(pdfLib);
            
            statusDiv.innerHTML = '🔄 Merging pages...';

            for (const { name, data } of fileBuffers) {
                try {
                    const sourceDoc = await loadPdfDocument(pdfLib, data);
                    await copyAllPages(sourceDoc, mergedPdf);
                } catch (err) {
                    throw new Error(`Failed to process "${name}": ${err.message}`);
                }
            }

            statusDiv.innerHTML = '💾 Saving merged file...';
            const mergedBytes = await savePdf(mergedPdf);

            const baseName = selectedFiles[0].name.replace(/\.pdf$/i, '');
            const outputName = `${baseName}_merged.pdf`;

            downloadPdf(mergedBytes, outputName);

            statusDiv.innerHTML = '✅ Merge completed successfully!';
        } catch (error) {
            statusDiv.innerHTML = `❌ Error: ${error.message}`;
            console.error('Merge error:', error);
        } finally {
            mergeBtn.disabled = false;
            mergeBtn.textContent = 'Merge Files';
            // Re-enable button state based on file count
            mergeBtn.disabled = selectedFiles.length < 2;
        }
    });

    // Initial update
    updateFileList();
}