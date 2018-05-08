# Mock Minder for OSE

A mock implementation of CA's SiteMinder that simplifies development of OSE web applications that require SiteMinder integration without configuring *real* SiteMinder in the personal or team development environment.

Runs as a reverse proxy using node-http-proxy library and injects custom logic to protect a target site, handling logins and managing SM session state.

## Motivation

* Streamline development of web applications applications that integrate with SiteMinder without going through SiteMinder provisioning and congifugration hussle.
* Easily test SiteMinder integration in the personal and team sandbox environments

## Features

### Control access to protected path(s)

- Configure protected path(s) in config.json.
- Validate presence of SMSESSION cookie.
- Redirect to configured logon URL for authentication.


### Authentication

- Handle authentication requests to a configured login FCC.
- Redirect to the TARGET after credential validation.
- Assign a FORMCRED cookie to track credential validation results.
- Configure mock users with authentication headers control.

## Getting Started

### Provision Mock Minder OSE application

Mock Minder for OSE is a Node.js based application. 

* Start with provisioning new Node.js based application using Web Console or command line:

```
rhc app-create <mock-sm-app-name> nodejs-0.10 -n <your-domain-name>
```

* There is currently connectivity issue between OSE and Codehub so it is not possible to use `--from-code` option to automatically seed new OSE applicaton with Mock Minder source code. You have to do it manually using the following commands

```
cd <mock-sm-app-name>
git remote add codehub https://codehub.optum.com/ose-commons/siteminder-proxy.git
git pull  -s recursive -X theirs --no-edit codehub master
git push
```

### Configure Mock Minder

Configure Mock Minder by editing config.json and pushing changes back to Mock Minder gear. Example configuration is shown below.

```
{  
   "proxy": {  
       "port": 8080,                // Port Mock Minder listens on. Defaulted to OPENSHIFT_NODEJS_PORT in OSE.  
       "localAddress": "127.0.0.1", // Local adderss Mock Minder listens on. Defaulted to OPENSHIFT_NODEJS_IP in OSE.                  
       "changeOrigin": true,        // Change the origin of the host header to the target URL. Default is true.          
       "xfwd": true,                // Add x-forward headers. Default is true.  
       "hostRewrite": null          // Rewrite the location hostname on (301/302/307/308) redirects, Default: OPENSHIFT_APP_DNS.
    },  
    "siteminder": {       
        "sm_cookie": "SMSESSION",          
        "sm_cookie_domain": "",                
        "formcred_cookie": "FORMCRED",                
        "formcred_cookie_domain": "",
        "userid_field": "USERNAME",
        "password_field": "PASSWORD",                
        "target_field": "TARGET",        
        "session_expiry_minutes": 20,        
        "max_login_attempts": 3,        
        "smagentname": "",        
        "login_fcc": "/public/siteminderagent/login.fcc"        
    },
    "upstreamApp": {    
        "target": "http://author-aem.ose-pstage.optum.com", // Destination application URL        
        "logon": "/public/logon",                           // Logon URL used by Mock Minder        
        "logoff": "/public/logoff",                         // Logoff URL used by Mock Minder        
        "home": "/welcome.html",                            // Home page Mock Minder redirects to after logoff        
        "filters":[                                         // List of protected URLs (regex expressions are supported)        
            { "path": "/*",                                 // Filtering rules are applied in order they are defined
              "protected": true }                
          ]            
        "rewrites": [                                       // URL rewrites to be applied before filtering rules
            {   "pattern": "^\/$",
                "target": "/welcome.html"
                }
        ]
        "ignoreExt": [".css",".js", ".gif", ".jpeg", ".png"] // List of extensions to ignore (not handled by Mock Minder)   
    },    
    "users": [                                              // List of mock users    
        {        
            "name": "admin",               
            "password": "admin",            
            "auth_headers": {            
                "client-id": "admin",                    
                "SM_USER": "admin"                
            },            
            "login_attempts": 0,            
            "locked": false},
        {                
            "name": "aparker@geometrixx.info",                
            "password": "password",            
            "auth_headers": {            
                "SM_USER": "aparker@geometrixx.info"                    
            },            
            "login_attempts": 0,            
            "locked": false}
    ]  
}
```
