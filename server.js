var http = require('http'),
    url = require('url'),
    httpProxy = require('http-proxy'),
    MockMinder = require('./lib/mockminder.js'),
    log = require('./lib/logger'),
    express = require('express'),
    path = require('path'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    fs = require('fs'),
    rewrite = require('express-urlrewrite');


var MockMinderApp = function () {

    var self = this;

    self.setup = function (config_file) {
        if (!fs.existsSync(config_file)) {
            log.error('#server', 'Config file %s does not exist', config_file);
            process.exit();
        }

        self.mm = new MockMinder(config_file, log);
        self.ipaddress = self.mm.config.proxy().localAddress;
        self.port = self.mm.config.proxy().port;
        self.upstreamApp = self.mm.config.upstreamApp();
    };

    self.createRoutes = function (app, config_file) {

        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'ejs');
        app.use(express.favicon());
        app.use(express.urlencoded());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        app.use(bodyParser.urlencoded({
            extended: false
        }));
        
        //self.upstreamApp.rewrites.forEach(function(rule) {
        //    app.use(rewrite(new RegExp(rule.pattern), rule.target));
        //});
        app.use(app.router);

        app.get(self.upstreamApp.logon, self.mm.logon);
        app.get(self.upstreamApp.logoff, self.mm.logoff);

        // Cannot use express.static because of proxy
        app.get('/stylesheets/:file', self.serveCSS);
        app.post('/public/siteminderagent/login.fcc', self.mm.processLogon);

        // Process ignoreExt
        self.upstreamApp.ignoreExt.forEach(function(ext) {
            log.info('Adding ignoreExt: ' + ext);
            app.get(new RegExp(ext + '$'), self.proxyHandler);
        });
                                           
        // Protected resources that need SM intervention
        self.upstreamApp.filters.forEach(function (f) {
            if (f.protected) {
                log.info('Adding filter path: ' + f.path);
                app.all(f.path, self.filter);
            } else {
                log.info('Adding uprotected path: ' + f.path);
                app.all(f.path, self.proxyHandler);
            }
        });

        app.all('/', self.proxyHandler);
        app.all('/*', self.proxyHandler);

    };

    self.serveCSS = function (req, res) {
        var file = req.params.file;
        res.sendfile(__dirname + '/static/stylesheets/' + file);
    };

    self.filter = function (req, res) {
        self.mm.filter(req, res, self.proxyHandler);
    };

    self.proxyError = function (err, req, res) {
        res.writeHead(502, {
            'Content-Type': 'text/plain'
        });

        res.end('Proxy connection refused');
    };

    self.proxyHandler = function (req, res) {
        self.proxy.web(req, res, {
            target: self.upstreamApp.target
        });
    };

    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initialize = function (config_file) {
        self.setup(config_file);
        self.app = express();
        self.proxy = httpProxy.createProxyServer({
            changeOrigin: self.mm.config.proxy().changeOrigin,
            xfwd: self.mm.config.proxy().xfwd,
            hostRewrite: self.mm.config.proxy().hostRewrite,
            secure:false
        });
        self.createRoutes(self.app, config_file);
        self.proxy.on('error', self.proxyError);
    };

    self.start = function () {

        self.app.listen(self.port, self.ipaddress, function () {
            log.info('Mock Minder server listening on: ' + self.ipaddress + ':' + self.port);
        });
    };
};

var mockMinderApp = new MockMinderApp();
mockMinderApp.initialize('config.json');
mockMinderApp.start();
