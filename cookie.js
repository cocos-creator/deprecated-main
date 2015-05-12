/**
* override getter and setter function of document cookie
*/

(function(document) {
    localStorage.cookies = localStorage.cookies || (localStorage.cookies = '{}');
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
