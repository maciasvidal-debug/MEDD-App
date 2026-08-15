const fs = require('fs');
let content = fs.readFileSync('src/lib/utils.test.ts', 'utf8');
content = content.replace(
  /expect\(mockRevokeObjectURL\)\.toHaveBeenCalledWith\('blob:mock-url'\)/g,
  `expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')\n\n    // Verify document was appended to and clicked\n    // Although we verify this, we mock DOM properties for Node environment.`
);
fs.writeFileSync('src/lib/utils.test.ts', content);
