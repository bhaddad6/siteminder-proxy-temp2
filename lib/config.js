var fs = require('fs');

var Proxy = function (config) {
    var self = this;

    self.port = process.env.OPENSHIFT_NODEJS_PORT || config.port || 8080;
    self.localAddress = process.env.OPENSHIFT_NODEJS_IP || config.localAddress || '127.0.0.1';
    self.changeOrigin = config.changeOrigin || true;
    self.xfwd = config.xfwd || true;
    self.hostRewrite = process.env.OPENSHIFT_APP_DNS || config.hostRewrite;
};

var UpstreamApp = function (config) {
    var self = this;

    self.target = config.target;
    self.port = config.port;
    self.logon = config.logon;
    self.logoff = config.logoff;
    self.home = config.home;
    self.filters = config.filters;
    self.rewrites = config.rewrites;
    self.ignoreExt = config.ignoreExt;
};

var SiteMinder = function (config) {
    var self = this;

    self.sm_cookie = config.sm_cookie || "SMSESSION";
    self.sm_cookie_domain = config.sm_cookie_domain;
    self.formcred_cookie = config.formcred_cookie || "FORMCRED";
    self.formcred_cookie_domain = config.formcred_cookie_domain;
    self.userid_field = config.userid_field || "USERNAME";
    self.password_field = config.password_field || "PASSWORD";
    self.target_field = config.target_field || "TARGET";
    self.session_expiry_minutes = config.session_expiry_minutes || 20;
    self.max_login_attempts = config.max_login_attempts || 3;
    self.smagentname = config.smagentname || "";
    self.login_fcc = config.login_fcc || "/public/siteminderagent/login.fcc";
};

var Config = function () {
    var self = this;
    this._config = {};

    this.load = function (filename) {
        self._config = JSON.parse(fs.readFileSync(filename, 'utf8'));
    };

    this.proxy = function () {
        return new Proxy(self._config.proxy);
    };

    this.siteminder = function () {
        return new SiteMinder(self._config.siteminder);
    };

    this.upstreamApp = function () {
        return new UpstreamApp(self._config.upstreamApp);
    };

    this.users = function () {
        return self._config.users;
    };
};

module.exports = Config;