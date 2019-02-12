var cli = require('commander');
var pkginfo = require('./package.json');
var Engine = require('./lib/engine.js')

var main = function () {
    cli
        .version(pkginfo.version, '-v, --version')
        .option('-r, --sr [sr]', 'Sampling Rate (Hz)', 50)
        .option('-g, --grange [grange]', 'Dynamic Range (g)', 8)
        .option('-n, --max_conns [max_conns]', 'Maximum connections', 2)
        .option('-p, --init_port [initial_port]', 'Initial port', 8000)
        .parse(process.argv);
    var engine = new Engine(cli.sr, cli.grange, cli.max_conns, cli.init_port);
    engine.start();
}

main();