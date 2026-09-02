/**
 * Core file handling utilities
 * - Read files as ArrayBuffer
 * - Convert to Uint8Array
 * - Download blob as file
 */

/**
 * Read uploaded files and return array of { name, data: Uint8Array }
 */
export async function readFilesAsBuffers(fileList) {
    const results = [];
    for (const file of fileList) {
        const buffer = await file.arrayBuffer();
        results.push({
            name: file.name,
            data: new Uint8Array(buffer)
        });
    }
    return results;
}

/**
 * Download a Uint8Array as a PDF file
 */
export function downloadPdf(data, filename = 'document.pdf') {
    const blob = new Blob([data], { type: 'application/pdf' });
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
 * Download multiple files one by one (simple approach)
 */
export function downloadMultiple(files) {
    for (const file of files) {
        downloadPdf(file.data, file.name);
    }
}