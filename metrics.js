/**
 *
 * Created by nantas on 15/3/25.
 */
var startTime;
var Editor = Editor || {};

(function(document) {
    localStorage.cookies || (localStorage.cookies = '{}');
    document.__defineGetter__('cookie', function() {
      var cookieName, cookies, output, val;
      cookies = JSON.parse(localStorage.cookies);
      output = [];
      for (cookieName in cookies) {
        val = cookies[cookieName];
        output.push(cookieName + '=' + val);
      }
      return output.join(';');
    });
    document.__defineSetter__('cookie', function(s) {
      var cookies, indexOfSeparator, key, value;
      indexOfSeparator = s.indexOf('=');
      key = s.substr(0, indexOfSeparator);
      value = s.substring(indexOfSeparator + 1);
      cookies = JSON.parse(localStorage.cookies);
      cookies[key] = value;
      localStorage.cookies = JSON.stringify(cookies);
      return key + '=' + value;
    });
    document.clearCookies = function() {
      delete localStorage.cookies;
    };
    document.__defineGetter__('location', function() {
      var url;
      url = 'fireball-x.com';
      return {
        href: 'http://' + url,
        protocol: 'http:',
        host: url,
        hostname: url,
        port: '',
        pathname: '/',
        search: '',
        hash: '',
        username: '',
        password: '',
        origin: 'http://' + url
      };
    });
    return document.__defineSetter__('location', function() {});
  })(document);
  
Editor.Metrics = {
    //segment identification
    identifyUser: function(user) {//userId, email, username, fullname, company, newsletter
       if (analytics && user) {
         console.log('identifying user');
         analytics.identify(user.id, {
           name: user.fullname,
           email: user.email,
           username: user.username,
           company: user.company,
           newsletter: user.subscribes.newsletter
         });
       }
    },
    //mixpanel event
    trackDashboardOpen: function() {
        if (analytics)
            analytics.track("Dashboard Open");
    },
    trackEditorOpen: function() {
        startTime = new Date();
        if (analytics)
            analytics.track("Editor Open");
    },
    trackEditorClose: function() {
        var duration = (new Date() - startTime)*1000/60; //calculate minutes
        if (analytics)
            analytics.track("Editor Close", {
                "Duration In Minutes": duration
            });
    },
    trackCreateNewScene: function() {
        if (analytics)
            analytics.track("Create New Scene");
    },
    trackOpenScene: function() {
        if (analytics)
            analytics.track("Open Scene");
    },
    trackPlayInEditor: function() {
        if (analytics)
            analytics.track("Play In Editor");
    },
    trackBuild: function(target) {
        if (analytics)
            analytics.track("Build", {
                "Target Platform": target
            });
    },
    trackOpenCodeEditor: function() {
        if (analytics)
            analytics.track("Open Code Editor");
    }
    //trackEditorCrash:
};
