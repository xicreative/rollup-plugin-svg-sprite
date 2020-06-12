'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var path = _interopDefault(require('path'));
var fs = _interopDefault(require('fs-extra'));
var cheerio = _interopDefault(require('cheerio'));
var SVGO = _interopDefault(require('svgo'));

function createSymbol(code, id) {
  const markup = cheerio.load(code, {
    xmlMode: true
  });
  const svgMarkup = markup('svg');
  const symbolId = svgMarkup.find('title').text() || id;
  const viewBox = svgMarkup.attr('viewBox') || [0, 0, svgMarkup.attr('width'), svgMarkup.attr('height')].join(' ');
  markup('svg').replaceWith('<symbol/>');
  markup('symbol').attr('id', symbolId).attr('viewBox', viewBox).append(svgMarkup.children());
  return markup.xml('symbol');
}

function createSprite(symbols) {
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`;
}

function svgSprite(options = {}) {
  const {
    minify = true,
    outputFolder,
    ...rest
  } = options;

  if (!outputFolder) {
    throw new Error('"outputFolder" must be set');
  }

  const svgo = new SVGO({
    js2svg: {
      pretty: !minify,
      indent: 2
    },
    plugins: [{
      cleanupIDs: false
    }, {
      removeDimensions: true
    }, {
      removeViewBox: false
    }, ...Object.entries(rest).map(([plugin, params]) => ({
      [plugin]: params
    }))]
  });
  const loadedSvgs = new Set();
  const convertedSvgs = new Map();
  return {
    name: 'svg-sprite',

    load(id) {
      if (id.endsWith('.svg')) {
        loadedSvgs.add(id);
      }

      return null;
    },

    transform(code, id) {
      if (!id.endsWith('.svg')) {
        return null;
      }

      const filename = path.basename(id, '.svg');
      convertedSvgs.set(id, createSymbol(code, filename));
      return {
        code: ''
      };
    },

    async writeBundle() {
      if (loadedSvgs.size) {
        const symbols = [...loadedSvgs.values()].map(id => convertedSvgs.get(id));
        const {
          data
        } = await svgo.optimize(createSprite(symbols));
        await fs.ensureDir(outputFolder);
        await fs.writeFile(`${outputFolder}/sprites.svg`, data);
        loadedSvgs.clear();
      }
    }

  };
}

module.exports = svgSprite;
