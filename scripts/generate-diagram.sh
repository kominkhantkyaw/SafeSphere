#!/bin/bash

# Script to generate images from Mermaid diagrams
# This requires @mermaid-js/mermaid-cli to be installed

echo "Generating diagram images from Mermaid files..."

# Check if mmdc is installed
if ! command -v mmdc &> /dev/null; then
    echo "Installing @mermaid-js/mermaid-cli..."
    npm install -g @mermaid-js/mermaid-cli
fi

# Create output directory
mkdir -p docs/diagram-images

# Extract and convert each diagram
# This script extracts Mermaid code blocks and converts them to images

echo "Note: This script requires manual extraction of Mermaid code blocks."
echo "For automatic conversion, use a tool like pandoc with mermaid filter,"
echo "or use an online Mermaid editor to export as images."

echo ""
echo "Alternative: Use https://mermaid.live/ to paste each diagram and export as PNG/SVG"
