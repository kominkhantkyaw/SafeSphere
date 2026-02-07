#!/usr/bin/env node

/**
 * Script to extract Mermaid diagrams from markdown and convert them to images
 * This allows the diagrams to display properly in PDF exports
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const markdownFile = path.join(__dirname, 'User_Flow_Diagrams_Production.md');
const outputDir = path.join(__dirname, 'diagram-images');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read the markdown file
const content = fs.readFileSync(markdownFile, 'utf8');

// Extract Mermaid code blocks
const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
let match;
let diagramIndex = 0;
const diagramNames = [
  '1-authentication',
  '2-incident-reporting',
  '3-tactical-map',
  '4-preparedness',
  '5-messaging',
  '6-inventory',
  '7-admin-panel',
  '8-directory',
  '9-settings'
];

const diagrams = [];

while ((match = mermaidRegex.exec(content)) !== null) {
  const diagramCode = match[1].trim();
  const diagramName = diagramNames[diagramIndex] || `diagram-${diagramIndex + 1}`;
  
  // Save to .mmd file
  const mmdFile = path.join(outputDir, `${diagramName}.mmd`);
  fs.writeFileSync(mmdFile, diagramCode);
  
  diagrams.push({
    index: diagramIndex,
    name: diagramName,
    code: diagramCode,
    mmdFile: mmdFile
  });
  
  diagramIndex++;
}

console.log(`Extracted ${diagrams.length} diagrams`);

// Check if mmdc is available
try {
  execSync('mmdc --version', { stdio: 'ignore' });
  console.log('Converting diagrams to images...');
  
  diagrams.forEach((diagram, idx) => {
    const outputFile = path.join(outputDir, `${diagram.name}.png`);
    try {
      execSync(`mmdc -i "${diagram.mmdFile}" -o "${outputFile}" -w 1200 -H 800 -b white`, { stdio: 'inherit' });
      console.log(`✓ Converted ${diagram.name}.png`);
    } catch (error) {
      console.error(`✗ Failed to convert ${diagram.name}:`, error.message);
    }
  });
  
  console.log('\n✓ All diagrams converted!');
  console.log('Update the markdown file to reference these images.');
  
} catch (error) {
  console.log('\n⚠️  Mermaid CLI (mmdc) not found.');
  console.log('Install it with: npm install -g @mermaid-js/mermaid-cli');
  console.log('Or use https://mermaid.live/ to convert each diagram manually.');
  console.log('\nDiagram files saved to:', outputDir);
}
