# 991-PDFTools

**Client-side PDF processing tools** – a collection of 10 pure JavaScript utilities that run entirely in your browser.  
No file uploads, no servers, no data leaving your device. Just fast, private, and secure PDF manipulation.

---

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [File Structure](#file-structure)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
  - [Local Testing](#local-testing)
  - [Integration into Your Website](#integration-into-your-website)
- [Tool List](#tool-list)
- [Browser Compatibility](#browser-compatibility)
- [Disclaimer](#disclaimer)
- [License](#license)
- [Changelog](#changelog)

---

## Features

- **100% Client-Side** – All processing happens in your browser. No files are uploaded to any server.
- **Privacy First** – Your documents never leave your device. Perfect for sensitive or personal files.
- **10 Powerful Tools** – Merge, split, compress, encrypt, convert, watermark, and more.
- **Modular Architecture** – Each tool is a standalone ES module. Import only what you need.
- **Framework Agnostic** – Works with any website or framework (React, Vue, vanilla HTML, etc.).
- **Zero Dependencies** – No external libraries required beyond `pdf-lib` and `PDF.js` (loaded from CDN).
- **Lightweight & Fast** – Minimal overhead, optimized for performance.

---

## Technologies Used

- **JavaScript (ES Modules)** – Modern, modular code structure.
- **[pdf-lib](https://pdf-lib.org/)** – Create, modify, and merge PDFs.
- **[PDF.js](https://mozilla.github.io/pdf.js/)** – Render PDF pages to canvas for image extraction.
- **Canvas API** – Image compression and conversion.
- **File API** – Read and process local files without upload.
- **JSZip** (optional) – Batch download multiple files as a ZIP archive.

---

## File Structure

```
991-pdftools/
├── src/
│   ├── core/
│   │   ├── fileHandler.js      # File I/O utilities (read, download)
│   │   └── pdfUtils.js          # Shared PDF operations (load, copy, save)
│   ├── tools/
│   │   ├── merge.js             # Merge multiple PDFs
│   │   ├── split.js             # Split PDF by ranges / N pages / odd-even
│   │   ├── extractPages.js      # Extract specific pages
│   │   ├── pdfToImage.js        # Convert PDF pages to images
│   │   ├── imageToPdf.js        # Convert images to PDF
│   │   ├── watermark.js         # Add text/image watermark
│   │   ├── pageNumber.js        # Add page numbers
│   │   ├── encrypt.js           # Password-protect PDF
│   │   ├── decrypt.js           # Remove password protection
│   │   └── compress.js          # Reduce file size by compressing images
│   └── index.js                 # Main entry point – exports all tools
├── test.html                    # Simple test harness for local development
├── LICENSE                      # MIT License
├── CHANGELOG.md                 # Version history
└── README.md                    # This file
```

---

## Installation & Setup

### Prerequisites

- Any modern web browser (Chrome, Firefox, Edge, Safari).
- For local development: a static file server (e.g., Live Server, Python HTTP Server).

### Get the Code

Clone the repository:

```bash
git clone https://github.com/rezashams991/991-pdftools.git
cd 991-pdftools
```

## Usage

### Local Testing

1. Open the project folder in your code editor.
2. Launch a local development server:
   - **VS Code**: Right-click `test.html` → "Open with Live Server".
   - **Python**: `python3 -m http.server 8000` then visit `http://localhost:8000/test.html`.
3. Click any tool button to test it.
4. Upload a PDF file and follow the on-screen instructions.

> **Note:** The `test.html` file is a minimal testing harness. It demonstrates how to dynamically import each tool from the `src/index.js` module.

### Integration into Your Website

To use these tools in your own website, you have two simple options:

#### Option 1: Copy the `src/` folder into your project

1. Copy the entire `src/` folder from this repository into your project root (or any subfolder).
2. Import the desired tool in your HTML:

```html
<script type="module">
    // Adjust the path to match your project structure
    import { merge, split, compress } from './src/index.js';
    
    // Render the Merge tool inside a container
    const container = document.getElementById('tool-container');
    merge(container);
</script>
```

#### Option 2: Keep this repository as a subfolder

1. Clone this repository into your project folder (e.g., `libs/991-pdftools`).
2. Import tools using the relative path:

```html
<script type="module">
    import { merge, watermark } from './libs/991-pdftools/src/index.js';
    // ... use as above
</script>
```

**Important:**  
- The tools will render their own UI inside the container you provide. No additional CSS is required (but you can style it to match your site).
- All file processing stays entirely in the browser – no data is ever sent to a server.

---

## Tool List

| Tool | Description |
|------|-------------|
| **Merge** | Combine multiple PDF files into one. |
| **Split** | Split a PDF into multiple files by page ranges, every N pages, or odd/even pages. |
| **Extract Pages** | Extract specific pages (e.g., `1,3,5-7`) from a PDF. |
| **PDF to Image** | Convert each page to a JPG or PNG image. |
| **Image to PDF** | Convert multiple images into a single PDF (one image per page). |
| **Watermark** | Add text or image watermark to all pages (custom opacity, rotation, position). |
| **Page Number** | Add page numbers with custom format, position, and style. |
| **Encrypt** | Password-protect a PDF with user/owner permissions. |
| **Decrypt** | Remove password protection (requires the correct password). |
| **Compress** | Reduce PDF file size by compressing embedded images. |

---

## Browser Compatibility

All tools are built with standard Web APIs and work in:

- **Chrome** 80+
- **Firefox** 75+
- **Edge** 80+
- **Safari** 13+

> **Note:** Some features (like `FileReader` and `Blob`) are widely supported. For older browsers, polyfills may be required.

---

## Disclaimer

**This software is provided for educational and personal use only.**

- The tools are **client-side only** – no data is transmitted or stored externally.
- The author is **not responsible** for any misuse, data loss, or damage resulting from the use of these tools.
- Always keep backups of your original files before processing them.

By using this software, you acknowledge that you understand and accept these terms.

---

## License

This project is licensed under the **MIT License**.  
See the [`LICENSE`](https://github.com/rezashams991/991-pdftools/blob/main/LICENSE) file for the full text.

**MIT License** – you are free to use, modify, distribute, and sublicense this software for any purpose, provided that the original copyright notice and permission notice are included.

---

## Contributing

Contributions are welcome! Feel free to open an [issue](https://github.com/rezashams991/991-pdftools/issues) or submit a pull request.

---

*Built with ❤ by [Reza Shams](https://github.com/rezashams991)*