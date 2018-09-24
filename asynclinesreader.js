'use strict'

/*
Command line:
node --no-warnings asynclinesreader.js input.txt output.txt

*/

const fs = require('fs')

function pb (edge = 0) {
  const rl = require('readline')

  const DEFAULT_FREQ = 500
  const HUNDRED_PERCENT = 100
  const PB_LENGTH = 50
  const PB_SCALE = HUNDRED_PERCENT / PB_LENGTH

  const NANOSECONDS_PER_SECOND = 1e9

  const hrStart = process.hrtime()

  function clearLine () {
    rl.cursorTo(process.stdout, 0)
    rl.clearLine(process.stdout, 0)
  }

  function getTimePast () {
    const hrEnd = process.hrtime(hrStart)
    return `${(
      (hrEnd[0] * NANOSECONDS_PER_SECOND + hrEnd[1]) /
      NANOSECONDS_PER_SECOND
    ).toFixed(1)} s`
  }

  return {
    edge,
    stat: 0,

    start (freq = DEFAULT_FREQ) {
      this.updater = setInterval(() => {
        this.update()
      }, freq)
    },

    update (stat = this.stat) {
      const statPercent =
        stat === this.edge || stat > this.edge
          ? HUNDRED_PERCENT
          : stat / this.edge * HUNDRED_PERCENT

      const barsNumber = Math.floor(statPercent / PB_SCALE)
      const padsNumber = PB_LENGTH - barsNumber

      clearLine()
      process.stdout.write(
        `${'█'.repeat(barsNumber)}${'░'.repeat(
          padsNumber
        )} ${statPercent.toFixed(
          1
        )}%  ${getTimePast()} (${stat.toLocaleString()} of ${this.edge.toLocaleString()})`
      )
    },

    end () {
      clearInterval(this.updater)
      this.stat = this.edge
      this.update()
      console.log('\n')
    },

    clear () {
      clearInterval(this.updater)
      clearLine()
    }
  }
}

class LinesReader {
  constructor (inputFilePath, options) {
    options = options || {}

    if (!options.highWaterMark) options.highWaterMark = 64 * 1024

    if (!options.encoding || options.encoding !== 'utf16le') {
      options.encoding = 'utf8'
    }

    this.options = options

    this.chunksAsync = fs.createReadStream(inputFilePath, {
      encoding: this.options.encoding,
      highWaterMark: this.options.highWaterMark
    })
  }

  async * chunksToLines () {
    let previous = ''

    for await (const chunk of this.chunksAsync) {
      const lines = chunk.split(/(?<=\r?\n|\r(?!\n))/u)

      if (previous !== '') lines[0] = previous + lines[0]

      if (!/[\r\n]$/.test(lines[lines.length - 1])) previous = lines.pop()
      else previous = ''

      yield lines
    }

    if (previous !== '') {
      yield [previous]
    }
  }
}
  
function guessEncoding (path) {
  const BOM_0 = 0xff
  const BOM_1 = 0xfe

  try {
    const fd = fs.openSync(path, 'r')
    const bf = Buffer.alloc(2)
    fs.readSync(fd, bf, 0, 2, 0)
    fs.closeSync(fd)
    return bf[0] === BOM_0 && bf[1] === BOM_1 ? 'utf16le' : 'utf8'
  } catch (e) {
    console.error(`Error: ${e.message}.`)
    return null
  }
}

function fileExists (filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch (err) {
    return false
  }
}

function processLine (line) {
  return line
}

async function main () {
  try {
    const input_encoding = guessEncoding(process.argv[2])
    const reader = new LinesReader(process.argv[2], {
      encoding: input_encoding
    })
    const output = fs.openSync(process.argv[3], 'w')
    const pbAsync = pb(fs.statSync(process.argv[2])['size'])

    pbAsync.start(1000)

    for await (let lines of reader.chunksToLines()) {
      const chunkToWrite = lines.map(processLine).join('')
      fs.writeSync(output, chunkToWrite, null, input_encoding)
      pbAsync.stat += Buffer.byteLength(chunkToWrite, input_encoding)
    }

    pbAsync.end()
  } catch (err) {
    console.log(err)
  }
}


if (process.argv.length === 4 && fileExists(process.argv[2])) {
  main()
} else {
  console.log('Invalid command line.')
  process.exit()
}
