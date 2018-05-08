var Cookies = require('cookies'),
    _ = require('underscore'),
    url = require('url'),
    Model = require('../lib/model.js'),
    Config = require('../lib/config'),
    log;

function MockMinder(filename, logger) {
    var self = this;
    log = logger;

    self.config = new Config();
    self.config.load(filename);

    self.sessions = {};
    self.emptySession = {};
    self.formcred = {};
    self.SESSION_COOKIE = self.config.siteminder().sm_cookie;
    self.FORMCRED_COOKIE = self.config.siteminder().formcred_cookie;

    self._createNewSession = function (new_session) {
        self.sessions[new_session.session_id] = new_session;
    };

    self._removeSession = function (session_id) {
        log.info('SiteMinder', 'SessionID %s has ended', session_id);
        delete(self.sessions[session_id]);
    };

    /** Get current SM session **/
    self._session = function (req) {
        var cookie = req.cookies[self.SESSION_COOKIE];
        return self.sessions[cookie];
    };

    /** Handle logon requests by processing form POST data and generating a FORMCRED cookie */
    self.processLogon = function (req, res) {
        var form = new Model.FormCred(),
            user = req.body.USER,
            password = req.body.PASSWORD,
            target = req.body.TARGET,
            log_msg, new_session;

        form.target_url = target;
        res.cookie(self.FORMCRED_COOKIE, form.formcred_id, {
            domain: self.config.siteminder().formcred_cookie_domain
        });

        // Search for the user, validate the password and set a status accordingly
        user = _.findWhere(self.config.users(), {
            'name': user
        });
        form.user = user;
        if (user) {
            if (user.password === password) {
                log.info('#processLogon', 'Authenticated');
                form.status = Model.FormCredStatus.good_login;
                // Reset the login attempts for the user now they have successfully authenticated.
                user.login_attempts = 0;
            } else {
                log.warn('#processLogon', 'User %s attempted login with bad password', user.name);
                form.status = Model.FormCredStatus.bad_password;
            }
        } else {
            log.warn('#processLogon', 'User with name %s not found', user.name);
            form.status = Model.FormCredStatus.bad_login;
        }

        self.formcred[form.formcred_id] = form;

        log.info('redirect to: ' + target);
        res.redirect(target);
    };

    self.filter = function (req, res, proxy) {
        var auth_headers,
            formcred_cookie = req.cookies[self.FORMCRED_COOKIE],
            formcred_session,
            session = self._session(req),
            user;

        log.info('Cookies: ', JSON.stringify(req.cookies));

        if (self.formcred) {
            formcred_session = self.formcred[formcred_cookie];
        }

        // Check the FORMCRED cookie if one exists and act accordingly
        if (_.isUndefined(formcred_session) === false) {
            log.info('#filter', 'Found existing FORMCRED session %s', formcred_session.formcred_id);
            // Remove for formcred session from self before doing any validation. 
            delete(self.formcred[formcred_cookie]);

            if (formcred_session.user) {
                user = _.findWhere(this.config.users(), {
                    'name': formcred_session.user.name
                });
                user = new Model.User(user);
                if (user && user.locked) {
                    log.warn('#filter', 'Account for user %s is currently locked', user.name);
                    this._accountLocked(req, res);
                    return;
                }
            }

            switch (formcred_session.status) {
                // Login was successful
            case Model.FormCredStatus.good_login:
                for (var session in self.sessions) {
                    if (self.sessions[session].name === formcred_session.name) {
                        delete(self.sessions[session]);
                        break;
                    }
                }

                user.login_attempts = 0;
                user.save(this.config.users());

                session = new Model.Session();
                session.resetExpiration(this.config.siteminder().session_expiry_minutes);
                session.user = formcred_session.user;
                self._createNewSession(session);

                session.resetExpiration(this.config.siteminder().session_expiry_minutes);
                res.cookie(self.SESSION_COOKIE, session.session_id, {
                    domain: self.config.siteminder().formcred_cookie_domain
                });
                log.info('#filter', 'New session %s created for user %s', session.session_id, user.name);
                break;

            case Model.FormCredStatus.bad_login:
                this.badLogin(req, res, 'Invalid credentials');
                return;

            case Model.FormCredStatus.bad_password:
                user.failedLogon(self.config.siteminder().max_login_attempts);
                user.save(this.config.users());

                // Check whether the user is locked for a second time now they have failed
                // a login attempt.
                if (user.locked) {
                    log.warn('#filter', 'Account for user %s is currently locked', user.name);
                    this.badLogin(req, res, 'Account locked');
                } else {
                    this.badLogin(req, res, 'Invalid credentials');
                }

                return;
            }
        } else if (_.isUndefined(session)) {
            log.warn('#filter', 'Session not found');
            return res.redirect('/public/logon?TARGET=' + req.url);
        } else if (session.hasExpired()) {
            log.warn('#filter', 'Session %s has expired', session.session_id);
            return res.redirect('/public/logon?TARGET=' + req.url);
        }

        auth_headers = session.user.auth_headers;

        // If there are auth_headers then add them to the request.
        if (auth_headers) {
            for (var header in auth_headers) {
                req.headers[header] = auth_headers[header];
            }
            log.info('#filter', 'Adding headers to request: ', JSON.stringify(auth_headers));
        }

        proxy(req, res);
    };

    self.logoff = function (req, res) {
        var current_session = self._session(req);

        if (current_session) {
            self._removeSession(current_session.session_id);
            log.info('#info', 'Logged off from session ID %s', current_session.session_id);
        }
        res.cookie(self.SESSION_COOKIE, 'LOGGEDOFF');
        res.redirect(self.config.upstreamApp().home);
    };

    self.logon = function (req, res) {
        res.render('logon', {
            title: 'Login',
            target: req.query.TARGET || '/',
            sm_login: self.config.siteminder().login_fcc
        });
    };

    self.badLogin = function (req, res, msg) {
        res.render('message', {
            title: 'Bad Login',
            message: msg,
            logon_url: self.config.upstreamApp().logon + '?TARGET=' + req.path,
            logoff_url: self.config.upstreamApp().logoff
        });
    };

}

module.exports = MockMinder;