'use strict';

const { createReadStream } = require('fs');

module.exports = async function* readLines(path, encoding = 'utf8') {
  const readable = createReadStream(path, encoding);
  let remainder = '';

  for await (const chunk of readable) {
    const lines = (remainder === '' ? chunk : `${remainder}${chunk}`)
                  .split(/(?<=\r?\n|\r(?!\n))/u);
    remainder = lines[lines.length - 1].endsWith('\n') ? '' : lines.pop();
    yield lines;
  }

  if (remainder !== '') yield [remainder];
};

/*


vsemozhetbyt:

I was trying to make some workaround with an intermediate async generator that splits chunks and yields a Promise for each line,
but such implementation was very slow, maybe due to many Promises involved.
So I've made a shift with an intermediate async generator that splits chunks and yields a Promise for an Array with lines from the chunk,
for now.

This implementation preserves line ending characters.
If I need any granular line processing or transformation,
I can use any Array functions (filter, map etc) on the consuming end.


https://github.com/nodejs/node/issues/23032#issuecomment-423779309

test.js:

_______________________________

'use strict';

const { openSync, writeSync } = require('fs');
const readLines = require('./read-lines-module.js');

const output = openSync('big-file-copy.txt', 'w');

(async function main() {
  try {
    for await (const lines of readLines('big-file.txt')) {
      writeSync(output, lines.join(''));
    }
  } catch (err) {
    console.error(err);
  }
})();

_______________________________


*/