export function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const output: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { output.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && measure(line + ' ' + word) > maxWidth) { output.push(line); line = ''; }
      if (measure(word) > maxWidth) {
        for (const letter of Array.from(word)) {
          if (line && measure(line + letter) > maxWidth) { output.push(line); line = ''; }
          line += letter;
        }
      } else line += (line ? ' ' : '') + word;
    }
    output.push(line);
  }
  return output;
}
