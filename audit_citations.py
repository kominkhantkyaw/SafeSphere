#!/usr/bin/env python3
import re

# Read the report
with open('Final_Project_Report.md', 'r') as f:
    content = f.read()

# Extract all citations (e.g., [1], [23], [15-16])
citations_in_text = re.findall(r'\[([0-9, \-]+)\]', content)

# Parse into sets of numbers
cited_numbers = set()
for citation in citations_in_text:
    # Handle ranges like [15-16] and lists [15, 16]
    for part in citation.split(','):
        part = part.strip()
        if '-' in part:
            try:
                start, end = part.split('-')
                cited_numbers.update(range(int(start), int(end)+1))
            except:
                pass
        else:
            try:
                cited_numbers.add(int(part))
            except:
                pass

print("Citations found in text (unique):", sorted(cited_numbers))
print("\nTotal unique citations:", len(cited_numbers))
print("\nMax citation number:", max(cited_numbers) if cited_numbers else "None")

# Check for problematic citations
print("\n--- POTENTIAL ISSUES ---")
if max(cited_numbers) > 34:
    print(f"⚠️  Text cites references beyond [34], but reference list ends at [34]")
    print(f"   Citations beyond [34]: {sorted([c for c in cited_numbers if c > 34])}")

# Extract what references are actually defined
ref_pattern = r'^\[\d+\]'
references_text = re.findall(ref_pattern, content, re.MULTILINE)
ref_numbers = set()
for ref in references_text:
    num = int(ref.strip('[]'))
    ref_numbers.add(num)

print("\nReferences defined:", sorted(ref_numbers))
print("\nCited but not defined:", sorted(cited_numbers - ref_numbers))
print("Defined but not cited:", sorted(ref_numbers - cited_numbers))
